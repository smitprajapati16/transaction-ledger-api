const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Account = require('../src/models/account.model');
const Transaction = require('../src/models/transaction.model');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./setup');

describe('Transaction API Endpoints', () => {
  let testAccount;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    // Create fresh test account
    testAccount = await Account.create({
      name: 'Test Ledger User',
      balance: 0,
    });
  });

  describe('POST /api/accounts/:accountId/transactions', () => {
    // 8. Credit an account and verify the balance
    it('should credit an account and update the balance accurately', async () => {
      const response = await request(app)
        .post(`/api/accounts/${testAccount._id}/transactions`)
        .send({
          type: 'credit',
          amount: 500,
          description: 'Account deposit',
          reference_id: 'REF-CREDIT-001',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Transaction created successfully');
      expect(response.body.data.balance).toBe('500.00');
      expect(response.body.data.transaction).toHaveProperty('id');
      expect(response.body.data.transaction.type).toBe('credit');
      expect(response.body.data.transaction.amount).toBe('500.00');
      expect(response.body.data.transaction.reference_id).toBe('REF-CREDIT-001');

      // Verify persisted state in MongoDB
      const updatedAccount = await Account.findById(testAccount._id);
      expect(updatedAccount.balance).toBe(50000); // 500.00 in minor units

      const txRecord = await Transaction.findOne({ reference_id: 'REF-CREDIT-001' });
      expect(txRecord).not.toBeNull();
      expect(txRecord.amount).toBe(50000);
      expect(txRecord.account_id.toString()).toBe(testAccount._id.toString());
    });

    // 9. Debit an account and verify the balance
    it('should debit an account and reduce balance accurately', async () => {
      // Pre-fund account with 100.00
      await Account.findByIdAndUpdate(testAccount._id, { balance: 10000 });

      const response = await request(app)
        .post(`/api/accounts/${testAccount._id}/transactions`)
        .send({
          type: 'debit',
          amount: 30,
          description: 'ATM withdrawal',
          reference_id: 'REF-DEBIT-001',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.balance).toBe('70.00');
      expect(response.body.data.transaction.amount).toBe('30.00');

      // Inspect persisted database state
      const updatedAccount = await Account.findById(testAccount._id);
      expect(updatedAccount.balance).toBe(7000); // 70.00 in minor units

      const txCount = await Transaction.countDocuments({ account_id: testAccount._id });
      expect(txCount).toBe(1);
    });

    // 10. Reject a debit exceeding the available balance
    it('should reject a debit exceeding available balance with 400', async () => {
      // Account balance is 100.00
      await Account.findByIdAndUpdate(testAccount._id, { balance: 10000 });

      const response = await request(app)
        .post(`/api/accounts/${testAccount._id}/transactions`)
        .send({
          type: 'debit',
          amount: 150,
          description: 'Attempted overdraft',
          reference_id: 'REF-OVERDRAFT-001',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/insufficient account balance/i);

      // Verify database state is untouched
      const accountAfter = await Account.findById(testAccount._id);
      expect(accountAfter.balance).toBe(10000); // Still 100.00
    });

    // 11. Confirm a failed debit creates no transaction record
    it('should confirm failed debit creates no transaction document', async () => {
      await Account.findByIdAndUpdate(testAccount._id, { balance: 5000 }); // 50.00

      await request(app)
        .post(`/api/accounts/${testAccount._id}/transactions`)
        .send({
          type: 'debit',
          amount: 60,
          description: 'Failed debit',
          reference_id: 'REF-FAIL-001',
        })
        .expect(400);

      const tx = await Transaction.findOne({ reference_id: 'REF-FAIL-001' });
      expect(tx).toBeNull();

      const totalTx = await Transaction.countDocuments({ account_id: testAccount._id });
      expect(totalTx).toBe(0);
    });

    // 12. Reject a duplicate reference for the same account
    it('should reject duplicate reference_id for same account with 409 Conflict', async () => {
      // First transaction
      await request(app)
        .post(`/api/accounts/${testAccount._id}/transactions`)
        .send({
          type: 'credit',
          amount: 100,
          description: 'Initial deposit',
          reference_id: 'REF-DUP-001',
        })
        .expect(201);

      // Second transaction with identical reference_id
      const response = await request(app)
        .post(`/api/accounts/${testAccount._id}/transactions`)
        .send({
          type: 'credit',
          amount: 50,
          description: 'Second deposit with duplicate ref',
          reference_id: 'REF-DUP-001',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/duplicate transaction/i);
    });

    // 13. Confirm a duplicate request does not change the balance
    it('should confirm duplicate request leaves balance and transaction records unchanged', async () => {
      await request(app)
        .post(`/api/accounts/${testAccount._id}/transactions`)
        .send({
          type: 'credit',
          amount: 100,
          description: 'Original credit',
          reference_id: 'REF-DUP-002',
        })
        .expect(201);

      const balanceBefore = (await Account.findById(testAccount._id)).balance;
      const countBefore = await Transaction.countDocuments({ account_id: testAccount._id });

      // Duplicate attempt
      await request(app)
        .post(`/api/accounts/${testAccount._id}/transactions`)
        .send({
          type: 'credit',
          amount: 100,
          description: 'Attempted duplicate',
          reference_id: 'REF-DUP-002',
        })
        .expect(409);

      const balanceAfter = (await Account.findById(testAccount._id)).balance;
      const countAfter = await Transaction.countDocuments({ account_id: testAccount._id });

      expect(balanceAfter).toBe(balanceBefore);
      expect(countAfter).toBe(countBefore);
    });

    // 14. Allow the same reference ID for a different account
    it('should allow the same reference ID for a different account', async () => {
      const otherAccount = await Account.create({
        name: 'Another Customer',
        balance: 0,
      });

      // Submit REF-SHARED to account 1
      await request(app)
        .post(`/api/accounts/${testAccount._id}/transactions`)
        .send({
          type: 'credit',
          amount: 100,
          description: 'Account 1 deposit',
          reference_id: 'REF-SHARED',
        })
        .expect(201);

      // Submit same REF-SHARED to account 2
      const response = await request(app)
        .post(`/api/accounts/${otherAccount._id}/transactions`)
        .send({
          type: 'credit',
          amount: 200,
          description: 'Account 2 deposit',
          reference_id: 'REF-SHARED',
        })
        .expect(201);

      expect(response.body.success).toBe(true);

      const txAccount1 = await Transaction.findOne({
        account_id: testAccount._id,
        reference_id: 'REF-SHARED',
      });
      const txAccount2 = await Transaction.findOne({
        account_id: otherAccount._id,
        reference_id: 'REF-SHARED',
      });

      expect(txAccount1).not.toBeNull();
      expect(txAccount2).not.toBeNull();
      expect(txAccount1.account_id.toString()).not.toBe(txAccount2.account_id.toString());
    });

    // 18. Reject invalid transaction types
    it('should reject invalid transaction types with 400', async () => {
      const response = await request(app)
        .post(`/api/accounts/${testAccount._id}/transactions`)
        .send({
          type: 'transfer',
          amount: 50,
          description: 'Invalid type',
          reference_id: 'REF-INVALID-TYPE',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/transaction type must be either 'credit' or 'debit'/i);
    });

    // 19. Reject zero, negative, and invalid monetary amounts
    it('should reject zero amount', async () => {
      const response = await request(app)
        .post(`/api/accounts/${testAccount._id}/transactions`)
        .send({
          type: 'credit',
          amount: 0,
          description: 'Zero amount',
          reference_id: 'REF-ZERO',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject negative amount', async () => {
      const response = await request(app)
        .post(`/api/accounts/${testAccount._id}/transactions`)
        .send({
          type: 'credit',
          amount: -50,
          description: 'Negative amount',
          reference_id: 'REF-NEG',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject amounts with more than two decimal places', async () => {
      const response = await request(app)
        .post(`/api/accounts/${testAccount._id}/transactions`)
        .send({
          type: 'credit',
          amount: '10.999',
          description: 'Too many decimals',
          reference_id: 'REF-3DEC',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/at most 2 decimal places/i);
    });

    // 20. Reject malformed account IDs
    it('should reject malformed account IDs with 400', async () => {
      const response = await request(app)
        .post('/api/accounts/not-a-valid-objectid/transactions')
        .send({
          type: 'credit',
          amount: 50,
          description: 'Malformed ID test',
          reference_id: 'REF-MALFORMED',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/invalid account ID format/i);
    });
  });

  describe('GET /api/accounts/:accountId/transactions', () => {
    beforeEach(async () => {
      // Create 3 transactions: 2 credits and 1 debit
      await Transaction.create([
        {
          account_id: testAccount._id,
          type: 'credit',
          amount: 10000,
          description: 'Credit 1',
          reference_id: 'HIST-001',
          created_at: new Date(Date.now() - 3000),
        },
        {
          account_id: testAccount._id,
          type: 'debit',
          amount: 4000,
          description: 'Debit 1',
          reference_id: 'HIST-002',
          created_at: new Date(Date.now() - 2000),
        },
        {
          account_id: testAccount._id,
          type: 'credit',
          amount: 5000,
          description: 'Credit 2',
          reference_id: 'HIST-003',
          created_at: new Date(Date.now() - 1000),
        },
      ]);
    });

    // 15. Retrieve all transactions
    it('should retrieve all transactions sorted newest first', async () => {
      const response = await request(app)
        .get(`/api/accounts/${testAccount._id}/transactions`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      // Newest first: Credit 2, Debit 1, Credit 1
      expect(response.body.data[0].reference_id).toBe('HIST-003');
      expect(response.body.data[1].reference_id).toBe('HIST-002');
      expect(response.body.data[2].reference_id).toBe('HIST-001');
    });

    // 16. Filter credit transactions
    it('should filter only credit transactions when type=credit', async () => {
      const response = await request(app)
        .get(`/api/accounts/${testAccount._id}/transactions?type=credit`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((t) => t.type === 'credit')).toBe(true);
    });

    // 17. Filter debit transactions
    it('should filter only debit transactions when type=debit', async () => {
      const response = await request(app)
        .get(`/api/accounts/${testAccount._id}/transactions?type=debit`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].type).toBe('debit');
      expect(response.body.data[0].reference_id).toBe('HIST-002');
    });

    it('should reject invalid query type filter with 400', async () => {
      const response = await request(app)
        .get(`/api/accounts/${testAccount._id}/transactions?type=invalid_type`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/query parameter 'type' must be either 'credit' or 'debit'/i);
    });

    it('should return empty array for account with no transactions', async () => {
      const emptyAccount = await Account.create({ name: 'Empty User' });

      const response = await request(app)
        .get(`/api/accounts/${emptyAccount._id}/transactions`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should return 404 when querying transactions for non-existent account', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .get(`/api/accounts/${fakeId}/transactions`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Concurrency & Data Integrity Tests', () => {
    // 21. Test concurrent debit requests against the same account
    it('should prevent overspending when simultaneous concurrent debits exceed balance', async () => {
      // Account balance = 100.00
      await Account.findByIdAndUpdate(testAccount._id, { balance: 10000 });

      // Fire 2 concurrent debit requests of 70.00 each simultaneously
      const req1 = request(app)
        .post(`/api/accounts/${testAccount._id}/transactions`)
        .send({
          type: 'debit',
          amount: 70,
          description: 'Concurrent debit 1',
          reference_id: 'CONC-DEBIT-1',
        });

      const req2 = request(app)
        .post(`/api/accounts/${testAccount._id}/transactions`)
        .send({
          type: 'debit',
          amount: 70,
          description: 'Concurrent debit 2',
          reference_id: 'CONC-DEBIT-2',
        });

      const [res1, res2] = await Promise.all([req1, req2]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(201);
      expect(statuses).toContain(400);

      // Persisted balance in DB must be exactly 30.00 (3000 minor units)
      const persistedAccount = await Account.findById(testAccount._id);
      expect(persistedAccount.balance).toBe(3000);

      // Exactly 1 transaction must be recorded
      const txCount = await Transaction.countDocuments({
        account_id: testAccount._id,
        reference_id: { $in: ['CONC-DEBIT-1', 'CONC-DEBIT-2'] },
      });
      expect(txCount).toBe(1);
    });

    // 22. Test simultaneous duplicate requests
    it('should reject simultaneous duplicate requests for the same reference ID', async () => {
      // Account balance = 500.00
      await Account.findByIdAndUpdate(testAccount._id, { balance: 50000 });

      // Send 2 identical transactions at the exact same moment
      const payload = {
        type: 'credit',
        amount: 50,
        description: 'Simultaneous duplicate test',
        reference_id: 'SIMUL-DUP-REF',
      };

      const [resA, resB] = await Promise.all([
        request(app)
          .post(`/api/accounts/${testAccount._id}/transactions`)
          .send(payload),
        request(app)
          .post(`/api/accounts/${testAccount._id}/transactions`)
          .send(payload),
      ]);

      const statuses = [resA.status, resB.status];
      expect(statuses).toContain(201);
      expect(statuses).toContain(409);

      // Balance must have increased by 50.00 only ONCE (to 550.00)
      const persistedAccount = await Account.findById(testAccount._id);
      expect(persistedAccount.balance).toBe(55000);

      // Exactly 1 transaction record must exist
      const count = await Transaction.countDocuments({
        account_id: testAccount._id,
        reference_id: 'SIMUL-DUP-REF',
      });
      expect(count).toBe(1);
    });
  });
});

