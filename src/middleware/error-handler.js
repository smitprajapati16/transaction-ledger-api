const AppError = require('../utils/app-error');

function errorHandler(err, req, res, next) {
  let error = err;

  // Handle express JSON body parser syntax errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = new AppError('Invalid JSON payload in request body', 400);
  }

  // Handle Mongoose CastError (e.g., malformed ObjectId)
  if (err.name === 'CastError') {
    error = new AppError(`Invalid format for field '${err.path}': ${err.value}`, 400);
  }

  // Handle Mongoose ValidationError
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    error = new AppError(`Validation error: ${messages.join(', ')}`, 400);
  }

  // Handle MongoDB Duplicate Key (E11000)
  if (err.code === 11000) {
    const fields = Object.keys(err.keyPattern || err.keyValue || {}).join(', ');
    error = new AppError(
      `Duplicate transaction detected. A transaction with this reference already exists for this account.`,
      409
    );
  }

  const statusCode = error.statusCode || 500;
  const message = error.isOperational ? error.message : 'Internal server error';

  const response = {
    success: false,
    message,
  };

  if (error.errors && Array.isArray(error.errors)) {
    response.errors = error.errors;
  }

  // Log unexpected errors on server side (without exposing stack trace to client)
  if (statusCode === 500 && process.env.NODE_ENV !== 'test') {
    console.error('Unhandled Server Error:', err);
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;

