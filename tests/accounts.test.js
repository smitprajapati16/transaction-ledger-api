const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Account = require('../src/models/account.model');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./setup');

describe('Account API Endpoints', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe('POST /api/accounts', () => {
    // 1. Create an account successfully
    it('should create an account successfully with valid name', async () => {
      const response = await request(app)
        .post('/api/accounts')
        .send({ name: 'Smit Prajapati' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Account created successfully');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe('Smit Prajapati');
      expect(response.body.data.balance).toBe('0.00');
      expect(response.body.data).toHaveProperty('created_at');

      // Verify persisted state in MongoDB
      const persisted = await Account.findById(response.body.data.id);
      expect(persisted).not.toBeNull();
      expect(persisted.name).toBe('Smit Prajapati');
      expect(persisted.balance).toBe(0);
    });

    // 2. Reject missing names
    it('should reject requests with missing name', async () => {
      const response = await request(app)
        .post('/api/accounts')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/name is required/i);

      // Verify no account was created in database
      const count = await Account.countDocuments();
      expect(count).toBe(0);
    });

    // 3. Reject empty names
    it('should reject requests with empty or whitespace-only name', async () => {
      const responseEmpty = await request(app)
        .post('/api/accounts')
        .send({ name: '' })
        .expect(400);

      expect(responseEmpty.body.success).toBe(false);

      const responseWhitespace = await request(app)
        .post('/api/accounts')
        .send({ name: '    ' })
        .expect(400);

      expect(responseWhitespace.body.success).toBe(false);

      const count = await Account.countDocuments();
      expect(count).toBe(0);
    });

    // 4. Confirm the initial balance is zero
    it('should confirm initial balance is strictly 0.00 in response and 0 in DB', async () => {
      const response = await request(app)
        .post('/api/accounts')
        .send({ name: 'Zero Balance User' })
        .expect(201);

      expect(response.body.data.balance).toBe('0.00');

      const persisted = await Account.findById(response.body.data.id);
      expect(persisted.balance).toBe(0);
    });

    // 5. Confirm a client cannot set the initial balance
    it('should not allow client to override initial balance or server fields', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const fakeTime = '2020-01-01T00:00:00.000Z';

      const response = await request(app)
        .post('/api/accounts')
        .send({
          name: 'Tamper Tester',
          balance: 999999,
          id: fakeId,
          _id: fakeId,
          created_at: fakeTime,
        })
        .expect(201);

      // Balance must still be 0.00
      expect(response.body.data.balance).toBe('0.00');
      expect(response.body.data.id).not.toBe(fakeId);
      expect(response.body.data.created_at).not.toBe(fakeTime);

      const persisted = await Account.findById(response.body.data.id);
      expect(persisted.balance).toBe(0);
      expect(persisted._id.toString()).not.toBe(fakeId);
    });
  });

  describe('GET /api/accounts/:accountId/balance', () => {
    // 6. Retrieve a balance successfully
    it('should retrieve account balance successfully', async () => {
      const account = await Account.create({
        name: 'Jane Doe',
        balance: 12550, // 125.50
      });

      const response = await request(app)
        .get(`/api/accounts/${account._id}/balance`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        account_id: account._id.toString(),
        balance: '125.50',
      });
    });

    // 7. Return 404 for an unknown account
    it('should return 404 for a non-existent account ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .get(`/api/accounts/${nonExistentId}/balance`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/account not found/i);
    });

    // Reject malformed account ID
    it('should return 400 for a malformed account ID', async () => {
      const response = await request(app)
        .get('/api/accounts/invalid-hex-id/balance')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/invalid account ID format/i);
    });
  });
});

