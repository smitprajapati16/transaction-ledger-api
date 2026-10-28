const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Account = require('../src/models/account.model');
const Transaction = require('../src/models/transaction.model');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./setup');

describe('Bonus: Money Transfer API Endpoints', () => {
  let accountA;
  let accountB;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // Create Account A with 100.00 (10,000 minor units)
    accountA = await Account.create({
      name: 'Account A',
      balance: 10000,
    });

    // Create Account B with 50.00 (5,000 minor units)
    accountB = await Account.create({
      name: 'Account B',
      balance: 5000,
    });
  });

  describe('POST /api/transfers', () => {
    it('should transfer money from Account A to Account B atomically (Example from spec: 30 from A to B)', async () => {
      const response = await request(app)
        .post('/api/transfers')
        .send({
          source_account_id: accountA._id.toString(),
          destination_account_id: accountB._id.toString(),
          amount: 30,
          description: 'Payment for services',
          reference_id: 'TRF-001',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Funds transferred successfully');
      expect(response.body.data.source_balance).toBe('70.00');
      expect(response.body.data.destination_balance).toBe('80.00');
      expect(response.body.data.amount).toBe('30.00');

      // Verify persisted state in MongoDB
      const updatedA = await Account.findById(accountA._id);
      const updatedB = await Account.findById(accountB._id);
      expect(updatedA.balance).toBe(7000); // 70.00
      expect(updatedB.balance).toBe(8000); // 80.00

      // Verify transaction ledger entries
      const txA = await Transaction.findOne({ account_id: accountA._id });
      const txB = await Transaction.findOne({ account_id: accountB._id });

      expect(txA).not.toBeNull();
      expect(txA.type).toBe('debit');
      expect(txA.amount).toBe(3000);

      expect(txB).not.toBeNull();
      expect(txB.type).toBe('credit');
      expect(txB.amount).toBe(3000);
    });

    it('should reject transfer when source account has insufficient balance', async () => {
      // Account A only has 100.00, attempting to transfer 150.00
      const response = await request(app)
        .post('/api/transfers')
        .send({
          source_account_id: accountA._id.toString(),
          destination_account_id: accountB._id.toString(),
          amount: 150,
          description: 'Overdraft transfer',
          reference_id: 'TRF-OVERDRAFT',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/insufficient balance/i);

      // Verify NEITHER account was modified (Atomicity guarantee)
      const afterA = await Account.findById(accountA._id);
      const afterB = await Account.findById(accountB._id);
      expect(afterA.balance).toBe(10000); // Unchanged: 100.00
      expect(afterB.balance).toBe(5000);  // Unchanged: 50.00

      // Zero transaction records created
      const txCount = await Transaction.countDocuments();
      expect(txCount).toBe(0);
    });

    it('should reject transfer when source account does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .post('/api/transfers')
        .send({
          source_account_id: fakeId,
          destination_account_id: accountB._id.toString(),
          amount: 25,
          reference_id: 'TRF-NO-SOURCE',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/source account not found/i);
    });

    it('should reject transfer when destination account does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .post('/api/transfers')
        .send({
          source_account_id: accountA._id.toString(),
          destination_account_id: fakeId,
          amount: 25,
          reference_id: 'TRF-NO-DEST',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/destination account not found/i);

      // Verify Account A was NOT debited
      const checkA = await Account.findById(accountA._id);
      expect(checkA.balance).toBe(10000);
    });

    it('should reject transfer when source and destination are the same account', async () => {
      const response = await request(app)
        .post('/api/transfers')
        .send({
          source_account_id: accountA._id.toString(),
          destination_account_id: accountA._id.toString(),
          amount: 10,
          reference_id: 'TRF-SAME-ACC',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/must be different/i);
    });

    it('should reject duplicate transfer reference', async () => {
      await request(app)
        .post('/api/transfers')
        .send({
          source_account_id: accountA._id.toString(),
          destination_account_id: accountB._id.toString(),
          amount: 10,
          reference_id: 'TRF-DUP-REF',
        })
        .expect(200);

      const response = await request(app)
        .post('/api/transfers')
        .send({
          source_account_id: accountA._id.toString(),
          destination_account_id: accountB._id.toString(),
          amount: 10,
          reference_id: 'TRF-DUP-REF',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/duplicate transfer/i);
    });

    it('should prevent overspending under concurrent simultaneous transfers', async () => {
      // Account A has 100.00. Fire two concurrent transfers of 70.00 each to Account B.
      const req1 = request(app)
        .post('/api/transfers')
        .send({
          source_account_id: accountA._id.toString(),
          destination_account_id: accountB._id.toString(),
          amount: 70,
          reference_id: 'CONC-TRF-1',
        });

      const req2 = request(app)
        .post('/api/transfers')
        .send({
          source_account_id: accountA._id.toString(),
          destination_account_id: accountB._id.toString(),
          amount: 70,
          reference_id: 'CONC-TRF-2',
        });

      const [res1, res2] = await Promise.all([req1, req2]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(400);

      // Account A must have exactly 30.00 left, and Account B must have 120.00
      const finalA = await Account.findById(accountA._id);
      const finalB = await Account.findById(accountB._id);

      expect(finalA.balance).toBe(3000);  // 30.00
      expect(finalB.balance).toBe(12000); // 120.00
    });
  });
});
