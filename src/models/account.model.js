const mongoose = require('mongoose');
const { formatFromMinorUnits } = require('../utils/money');

const accountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Account name is required'],
      trim: true,
      minlength: [1, 'Account name cannot be empty'],
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Account balance cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer minor unit balance',
      },
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
        ret.balance = formatFromMinorUnits(ret.balance);
        ret.created_at = ret.created_at ? ret.created_at.toISOString() : new Date().toISOString();
        delete ret._id;
        return ret;
      },
    },
  }
);

const Account = mongoose.model('Account', accountSchema);

module.exports = Account;

