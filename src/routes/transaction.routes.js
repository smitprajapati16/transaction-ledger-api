const express = require('express');
const router = express.Router({ mergeParams: true });
const transactionController = require('../controllers/transaction.controller');
const validateRequest = require('../middleware/validate-request');
const { accountIdParamSchema } = require('../validators/account.validator');
const {
  createTransactionSchema,
  listTransactionsQuerySchema,
} = require('../validators/transaction.validator');

/**
 * @route   POST /api/accounts/:accountId/transactions
 * @desc    Add a credit or debit transaction to an account
 */
router.post(
  '/',
  validateRequest({
    params: accountIdParamSchema,
    body: createTransactionSchema,
  }),
  transactionController.addTransaction
);

/**
 * @route   GET /api/accounts/:accountId/transactions
 * @desc    Retrieve sorted transaction history with optional type filter
 */
router.get(
  '/',
  validateRequest({
    params: accountIdParamSchema,
    query: listTransactionsQuerySchema,
  }),
  transactionController.getAccountTransactions
);

module.exports = router;

