require('dotenv').config();
const app = require('./app');
const { connectDB, disconnectDB } = require('./config/database');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`Transaction Ledger API server running on port ${PORT}`);
    });

    const gracefulShutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        console.log('HTTP server closed.');
        await disconnectDB();
        process.exit(0);
      });

      // Force shutdown after timeout if pending requests hang
      setTimeout(() => {
        console.error('Forcefully terminating process after timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled Promise Rejection:', reason);
    });

    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err);
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();

