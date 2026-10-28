const AppError = require('../utils/app-error');

function notFoundHandler(req, res, next) {
  next(new AppError(`Resource not found: ${req.method} ${req.originalUrl}`, 404));
}

module.exports = notFoundHandler;

