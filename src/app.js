const express = require('express');
const accountRoutes = require('./routes/account.routes');
const transferRoutes = require('./routes/transfer.routes');
const notFoundHandler = require('./middleware/not-found');
const errorHandler = require('./middleware/error-handler');

const app = express();

// Express JSON body parser
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Mount core API routes
app.use('/api/accounts', accountRoutes);
app.use('/api/transfers', transferRoutes);

// 404 handler for unknown routes
app.use(notFoundHandler);

// Centralized error handling middleware
app.use(errorHandler);

module.exports = app;

