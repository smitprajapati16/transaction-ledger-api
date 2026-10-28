const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transfer.controller');
const validateRequest = require('../middleware/validate-request');
const { transferSchema } = require('../validators/transfer.validator');

/**
 * @route   POST /api/transfers
 * @desc    Transfer funds atomically from source account to destination account (Bonus)
 */
router.post(
  '/',
  validateRequest({ body: transferSchema }),
  transferController.transfer
);

module.exports = router;
