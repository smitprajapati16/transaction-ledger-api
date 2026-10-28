const { z } = require('zod');

const amountSchema = z
  .union([
    z.number().positive('Amount must be greater than zero'),
    z.string().trim(),
  ])
  .refine(
    (val) => {
      const strVal = String(val).trim();
      return /^\d+(\.\d{1,2})?$/.test(strVal) && parseFloat(strVal) > 0;
    },
    {
      message: 'Amount must be a positive number with at most 2 decimal places',
    }
  );

const createTransactionSchema = z.object({
  type: z.enum(['credit', 'debit'], {
    errorMap: () => ({ message: "Transaction type must be either 'credit' or 'debit'" }),
  }),
  amount: amountSchema,
  description: z
    .string({
      required_error: 'Description is required',
      invalid_type_error: 'Description must be a string',
    })
    .trim()
    .min(1, 'Description cannot be empty')
    .max(255, 'Description cannot exceed 255 characters'),
  reference_id: z
    .string({
      required_error: 'reference_id is required',
      invalid_type_error: 'reference_id must be a string',
    })
    .trim()
    .min(1, 'reference_id cannot be empty')
    .max(100, 'reference_id cannot exceed 100 characters'),
});

const listTransactionsQuerySchema = z.object({
  type: z
    .enum(['credit', 'debit'], {
      errorMap: () => ({ message: "Query parameter 'type' must be either 'credit' or 'debit'" }),
    })
    .optional(),
});

module.exports = {
  createTransactionSchema,
  listTransactionsQuerySchema,
};

