const express = require('express');
const router = express.Router();
const accountController = require('../controllers/account.controller');
const transactionRouter = require('./transaction.routes');
const validateRequest = require('../middleware/validate-request');
const {
  createAccountSchema,
  accountIdParamSchema,
} = require('../validators/account.validator');

/**
 * @route   POST /api/accounts
 * @desc    Create a new account with zero initial balance
 */
router.post(
  '/',
  validateRequest({ body: createAccountSchema }),
  accountController.createAccount
);

/**
 * @route   GET /api/accounts/:accountId/balance
 * @desc    Retrieve current persisted balance for an account
 */
router.get(
  '/:accountId/balance',
  validateRequest({ params: accountIdParamSchema }),
  accountController.getAccountBalance
);

/**
 * Nested route for account transactions
 * Mounts /api/accounts/:accountId/transactions
 */
router.use('/:accountId/transactions', transactionRouter);

module.exports = router;

