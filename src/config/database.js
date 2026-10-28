const mongoose = require('mongoose');

/**
 * Connect to MongoDB using Mongoose.
 * @param {string} [uri] - Optional MongoDB connection URI override
 */
async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  try {
    const conn = await mongoose.connect(uri, {
      autoIndex: true, // Build defined indexes (including compound unique index)
    });

    if (process.env.NODE_ENV !== 'test') {
      console.log(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    }

    return conn;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    throw error;
  }
}

/**
 * Gracefully disconnect from MongoDB.
 */
async function disconnectDB() {
  try {
    await mongoose.disconnect();
    if (process.env.NODE_ENV !== 'test') {
      console.log('MongoDB connection disconnected');
    }
  } catch (error) {
    console.error('Error disconnecting MongoDB:', error.message);
  }
}

module.exports = {
  connectDB,
  disconnectDB,
};

