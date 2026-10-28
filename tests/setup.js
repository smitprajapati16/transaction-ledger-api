const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const Account = require('../src/models/account.model');
const Transaction = require('../src/models/transaction.model');

let replSet = null;

async function setupTestDB() {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });

  const uri = replSet.getUri();
  await mongoose.connect(uri);

  // Ensure database indexes are created
  await Account.init();
  await Transaction.init();
}

async function teardownTestDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
  }
}

async function clearTestDB() {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
}

module.exports = {
  setupTestDB,
  teardownTestDB,
  clearTestDB,
};

