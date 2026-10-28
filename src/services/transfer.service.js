const mongoose = require('mongoose');
const Account = require('../models/account.model');
const Transaction = require('../models/transaction.model');
const AppError = require('../utils/app-error');
const { toMinorUnits, formatFromMinorUnits } = require('../utils/money');

const MAX_TRANSACTION_RETRIES = 3;

class TransferService {
  /**
   * Transfers funds between two accounts within an atomic multi-document transaction.
   * Guarantees that source debit and destination credit both succeed or both roll back.
   *
   * @param {object} params
   * @param {string} params.source_account_id
   * @param {string} params.destination_account_id
   * @param {number|string} params.amount
   * @param {string} [params.description]
   * @param {string} params.reference_id
   * @returns {Promise<object>}
   */
  async transferFunds({
    source_account_id,
    destination_account_id,
    amount,
    description = 'Fund transfer',
    reference_id,
  }) {
    if (source_account_id === destination_account_id) {
      throw new AppError('Source and destination accounts must be different', 400);
    }

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

        // 1. Verify both accounts exist sequentially (MongoDB sessions do not support concurrent queries)
        const sourceAccount = await Account.findById(source_account_id).session(session);
        if (!sourceAccount) {
          throw new AppError('Source account not found', 404);
        }

        const destinationAccount = await Account.findById(destination_account_id).session(session);
        if (!destinationAccount) {
          throw new AppError('Destination account not found', 404);
        }

        // 2. Atomically debit source account with balance check
        const updatedSource = await Account.findOneAndUpdate(
          { _id: source_account_id, balance: { $gte: amountMinor } },
          { $inc: { balance: -amountMinor } },
          { session, new: true }
        );

        if (!updatedSource) {
          throw new AppError('Insufficient balance in source account', 400);
        }

        // 3. Atomically credit destination account
        const updatedDestination = await Account.findByIdAndUpdate(
          destination_account_id,
          { $inc: { balance: amountMinor } },
          { session, new: true }
        );

        // 4. Create ledger entries for both accounts
        const debitRef = `${reference_id}-DR`;
        const creditRef = `${reference_id}-CR`;

        const [sourceTx] = await Transaction.create(
          [
            {
              account_id: source_account_id,
              type: 'debit',
              amount: amountMinor,
              description: `Transfer to ${destinationAccount.name}: ${description}`,
              reference_id: debitRef,
            },
          ],
          { session }
        );

        const [destTx] = await Transaction.create(
          [
            {
              account_id: destination_account_id,
              type: 'credit',
              amount: amountMinor,
              description: `Transfer from ${sourceAccount.name}: ${description}`,
              reference_id: creditRef,
            },
          ],
          { session }
        );

        // 5. Commit transaction
        await session.commitTransaction();

        return {
          source_account_id,
          destination_account_id,
          amount: formatFromMinorUnits(amountMinor),
          source_balance: formatFromMinorUnits(updatedSource.balance),
          destination_balance: formatFromMinorUnits(updatedDestination.balance),
          reference_id,
          source_transaction_id: sourceTx._id.toString(),
          destination_transaction_id: destTx._id.toString(),
        };
      } catch (error) {
        if (session.inTransaction()) {
          try {
            await session.abortTransaction();
          } catch (abortErr) {}
        }

        // Duplicate reference_id caught by MongoDB compound unique index
        if (error.code === 11000) {
          throw new AppError(
            'Duplicate transfer detected. A transfer with this reference ID already exists.',
            409
          );
        }

        // Do not retry operational business failures
        if (error.isOperational) {
          throw error;
        }

        // Retry only transient transaction conflicts (e.g., WriteConflict)
        const isTransient =
          error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError');

        if (isTransient && attempt < MAX_TRANSACTION_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
          continue;
        }

        throw error;
      } finally {
        await session.endSession();
      }
    }
  }
}

module.exports = new TransferService();
