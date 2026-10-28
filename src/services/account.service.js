const Account = require('../models/account.model');
const AppError = require('../utils/app-error');
const { formatFromMinorUnits } = require('../utils/money');

class AccountService {
  /**
   * Creates a new account with guaranteed zero initial balance.
   * Disallows client-supplied balance or timestamps.
   *
   * @param {object} params
   * @param {string} params.name
   * @returns {Promise<Account>}
   */
  async createAccount({ name }) {
    const account = await Account.create({
      name: name.trim(),
      balance: 0,
      // created_at defaults to current server timestamp
    });

    return account;
  }

  /**
   * Retrieves the current persisted balance for an account.
   *
   * @param {string} accountId
   * @returns {Promise<{ account_id: string, balance: string }>}
   */
  async getAccountBalance(accountId) {
    const account = await Account.findById(accountId);
    if (!account) {
      throw new AppError('Account not found', 404);
    }

    return {
      account_id: account._id.toString(),
      balance: formatFromMinorUnits(account.balance),
    };
  }

  /**
   * Verifies account existence by ID.
   *
   * @param {string} accountId
   * @param {import('mongoose').ClientSession} [session]
   * @returns {Promise<Account>}
   */
  async findAccountById(accountId, session = null) {
    const query = Account.findById(accountId);
    if (session) {
      query.session(session);
    }
    const account = await query;
    if (!account) {
      throw new AppError('Account not found', 404);
    }
    return account;
  }
}

module.exports = new AccountService();

