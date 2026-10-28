/**
 * Monetary utility functions to ensure strict exactness without floating-point errors.
 * Amounts are internally persisted and manipulated as integer minor units (e.g., paise, cents).
 * e.g., 100.50 -> 10050 minor units.
 */

/**
 * Converts a numeric amount or string decimal to integer minor units.
 * Validates maximum 2 decimal places and positive value.
 *
 * @param {number|string} amount
 * @returns {number} Integer minor units
 */
function toMinorUnits(amount) {
  if (amount === undefined || amount === null) {
    throw new Error('Amount is required');
  }

  const strAmount = String(amount).trim();

  // Validate format: positive number with at most 2 decimal places
  if (!/^\d+(\.\d{1,2})?$/.test(strAmount)) {
    throw new Error('Invalid monetary format. Expected positive number with up to 2 decimal places.');
  }

  const [whole, fraction = ''] = strAmount.split('.');
  const paddedFraction = fraction.padEnd(2, '0');
  const minorUnits = parseInt(whole, 10) * 100 + parseInt(paddedFraction, 10);

  if (minorUnits <= 0) {
    throw new Error('Amount must be greater than zero.');
  }

  return minorUnits;
}

/**
 * Formats integer minor units into a standard two-decimal string representation.
 * e.g., 10050 -> "100.50", 0 -> "0.00", 5 -> "0.05"
 *
 * @param {number} minorUnits
 * @returns {string} Two-decimal string
 */
function formatFromMinorUnits(minorUnits) {
  if (minorUnits === undefined || minorUnits === null || isNaN(minorUnits)) {
    return '0.00';
  }

  const sign = minorUnits < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minorUnits));
  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;

  return `${sign}${whole}.${fraction.toString().padStart(2, '0')}`;
}

module.exports = {
  toMinorUnits,
  formatFromMinorUnits,
};

