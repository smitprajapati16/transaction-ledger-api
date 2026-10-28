const mongoose = require('mongoose');
const { formatFromMinorUnits } = require('../utils/money');

const transactionSchema = new mongoose.Schema(
  {
    account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'account_id is required'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: ['credit', 'debit'],
        message: "Transaction type must be either 'credit' or 'debit'",
      },
      required: [true, 'Transaction type is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Transaction amount is required'],
      min: [1, 'Transaction amount must be greater than zero'],
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer minor unit amount',
      },
    },
    description: {
      type: String,
      required: [true, 'Transaction description is required'],
      trim: true,
      minlength: [1, 'Transaction description cannot be empty'],
    },
    reference_id: {
      type: String,
      required: [true, 'Transaction reference_id is required'],
      trim: true,
      minlength: [1, 'reference_id cannot be empty'],
    },
    created_at: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    versionKey: false,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.account_id = ret.account_id.toString();
        ret.amount = formatFromMinorUnits(ret.amount);
        ret.created_at = ret.created_at ? ret.created_at.toISOString() : new Date().toISOString();
        delete ret._id;
        return ret;
      },
    },
  }
);

// Compound unique index to prevent duplicate reference_id per account
transactionSchema.index({ account_id: 1, reference_id: 1 }, { unique: true });

// Compound index to optimize sorted history and filtering
transactionSchema.index({ account_id: 1, created_at: -1, _id: -1 });
transactionSchema.index({ account_id: 1, type: 1, created_at: -1, _id: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;

