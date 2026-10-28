const { z } = require('zod');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const transferSchema = z
  .object({
    source_account_id: z
      .string({ required_error: 'source_account_id is required' })
      .trim()
      .regex(objectIdRegex, 'Invalid source_account_id format. Must be a 24-character hex string.'),
    destination_account_id: z
      .string({ required_error: 'destination_account_id is required' })
      .trim()
      .regex(objectIdRegex, 'Invalid destination_account_id format. Must be a 24-character hex string.'),
    amount: z
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
      ),
    description: z
      .string()
      .trim()
      .max(255)
      .optional()
      .default('Fund transfer'),
    reference_id: z
      .string({ required_error: 'reference_id is required' })
      .trim()
      .min(1, 'reference_id cannot be empty')
      .max(100),
  })
  .refine(
    (data) => data.source_account_id !== data.destination_account_id,
    {
      message: 'Source and destination accounts must be different',
      path: ['destination_account_id'],
    }
  );

module.exports = {
  transferSchema,
};

