const { z } = require('zod');

// Regex for valid MongoDB 24-character hex ObjectId
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const accountIdParamSchema = z.object({
  accountId: z
    .string()
    .trim()
    .regex(objectIdRegex, 'Invalid account ID format. Must be a 24-character hex string.'),
});

const createAccountSchema = z.object({
  name: z
    .string({
      required_error: 'Account holder name is required',
      invalid_type_error: 'Account holder name must be a string',
    })
    .trim()
    .min(1, 'Account holder name cannot be empty')
    .max(100, 'Account holder name cannot exceed 100 characters'),
});

module.exports = {
  createAccountSchema,
  accountIdParamSchema,
};

