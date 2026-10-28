const accountService = require('../services/account.service');

class AccountController {
  async createAccount(req, res, next) {
    try {
      const { name } = req.body;
      const account = await accountService.createAccount({ name });

      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: account.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  async getAccountBalance(req, res, next) {
    try {
      const { accountId } = req.params;
      const balanceData = await accountService.getAccountBalance(accountId);

      res.status(200).json({
        success: true,
        data: balanceData,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AccountController();

