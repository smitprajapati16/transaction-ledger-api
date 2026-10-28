const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('./app');
const Account = require('./models/account.model');
const Transaction = require('./models/transaction.model');

const PORT = process.env.PORT || 3000;

async function startDevServer() {
  console.log('Starting in-memory MongoDB replica set (zero setup required)...');
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });

  const uri = replSet.getUri();
  console.log(`In-memory MongoDB replica set active.`);

  await mongoose.connect(uri, { autoIndex: true });
  await Account.init();
  await Transaction.init();
  console.log('Database indexes synchronized.');

  const server = app.listen(PORT, () => {
    console.log(`\n==========================================================`);
    console.log(`🚀 Transaction Ledger API is ready at: http://localhost:${PORT}`);
    console.log(`==========================================================`);
    console.log(`Transactions, ACID rollbacks, and concurrency are fully active.\n`);
  });

  const shutdown = async () => {
    console.log('\nShutting down dev server...');
    server.close();
    await mongoose.disconnect();
    await replSet.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startDevServer().catch((err) => {
  console.error('Failed to start dev server:', err);
  process.exit(1);
});

