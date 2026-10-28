const transactionService = require('../services/transaction.service');

class TransactionController {
  async addTransaction(req, res, next) {
    try {
      const { accountId } = req.params;
      const { type, amount, description, reference_id } = req.body;

      const result = await transactionService.addTransaction({
        accountId,
        type,
        amount,
        description,
        reference_id,
      });

      res.status(201).json({
        success: true,
        message: 'Transaction created successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAccountTransactions(req, res, next) {
    try {
      const { accountId } = req.params;
      const { type } = req.query;

      const transactions = await transactionService.getAccountTransactions({
        accountId,
        type,
      });

      res.status(200).json({
        success: true,
        data: transactions,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TransactionController();

