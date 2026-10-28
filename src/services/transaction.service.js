const mongoose = require('mongoose');
const Account = require('../models/account.model');
const Transaction = require('../models/transaction.model');
const AppError = require('../utils/app-error');
const { toMinorUnits, formatFromMinorUnits } = require('../utils/money');

const MAX_TRANSACTION_RETRIES = 3;

class TransactionService {
  /**
   * Adds a transaction (credit or debit) within a MongoDB multi-document transaction.
   * Guarantees atomic balance update and prevents concurrent overdrafts.
   *
   * @param {object} params
   * @param {string} params.accountId
   * @param {'credit'|'debit'} params.type
   * @param {number|string} params.amount
   * @param {string} params.description
   * @param {string} params.reference_id
   * @returns {Promise<{ transaction: object, balance: string }>}
   */
  async addTransaction({ accountId, type, amount, description, reference_id }) {
    const amountMinor = toMinorUnits(amount);

    let attempt = 0;
    while (attempt < MAX_TRANSACTION_RETRIES) {
      attempt++;
      const session = await mongoose.startSession();

      try {
        session.startTransaction({
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
        });

        // 1. Verify account exists within the session
        const account = await Account.findById(accountId).session(session);
        if (!account) {
          throw new AppError('Account not found', 404);
        }

        // 2. Perform atomic balance update with concurrency-safe check
        let updatedAccount;
        if (type === 'debit') {
          // Conditional atomic update: balance must be >= amountMinor
          updatedAccount = await Account.findOneAndUpdate(
            { _id: accountId, balance: { $gte: amountMinor } },
            { $inc: { balance: -amountMinor } },
            { session, new: true }
          );

          if (!updatedAccount) {
            // Document matched 0 documents -> insufficient funds
            throw new AppError('Insufficient account balance', 400);
          }
        } else if (type === 'credit') {
          updatedAccount = await Account.findByIdAndUpdate(
            accountId,
            { $inc: { balance: amountMinor } },
            { session, new: true }
          );
        }

        // 3. Create transaction record
        // Unique compound index on { account_id: 1, reference_id: 1 } will reject duplicates
        const [transactionDoc] = await Transaction.create(
          [
            {
              account_id: accountId,
              type,
              amount: amountMinor,
              description: description.trim(),
              reference_id: reference_id.trim(),
            },
          ],
          { session }
        );

        // 4. Commit multi-document transaction
        await session.commitTransaction();

        const jsonTransaction = transactionDoc.toJSON();

        return {
          transaction: jsonTransaction,
          balance: formatFromMinorUnits(updatedAccount.balance),
        };
      } catch (error) {
        if (session.inTransaction()) {
          try {
            await session.abortTransaction();
          } catch (abortErr) {
            // Ignore abort error if already aborted or failed
          }
        }

        // Duplicate reference_id caught by MongoDB compound unique index
        if (error.code === 11000) {
          throw new AppError(
            'Duplicate transaction detected. A transaction with this reference ID already exists for this account.',
            409
          );
        }

        // Do not retry business failures or duplicate errors
        if (error.isOperational) {
          throw error;
        }

        // Retry only if it is a transient transaction conflict (e.g., WriteConflict)
        const isTransient =
          error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError');

        if (isTransient && attempt < MAX_TRANSACTION_RETRIES) {
          // Small backoff before retrying
          await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
          continue;
        }

        throw error;
      } finally {
        await session.endSession();
      }
    }
  }

  /**
   * Retrieves deterministic transaction history for an account.
   *
   * @param {object} params
   * @param {string} params.accountId
   * @param {string} [params.type]
   * @returns {Promise<Array<object>>}
   */
  async getAccountTransactions({ accountId, type }) {
    const accountExists = await Account.exists({ _id: accountId });
    if (!accountExists) {
      throw new AppError('Account not found', 404);
    }

    const filter = { account_id: accountId };
    if (type) {
      filter.type = type;
    }

    // Sort deterministic: newest creation date first, then _id
    const docs = await Transaction.find(filter).sort({ created_at: -1, _id: -1 });

    return docs.map((doc) => doc.toJSON());
  }
}

module.exports = new TransactionService();

