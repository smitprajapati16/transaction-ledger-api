# Transaction Ledger API

A robust, production-grade financial ledger RESTful API built with **Node.js**, **Express**, **MongoDB**, **Mongoose**, and **Zod**. This system provides reliable double-entry-style ledger capabilities for creating customer accounts, processing credit/debit transactions with ACID guarantees, querying account balances, and retrieving filtered transaction histories.

---

## 1. Project Overview & Architecture

Financial systems demand non-negotiable data integrity: an account balance must never fall below zero from uncoordinated debit operations, transactions must never be credited or debited multiple times under concurrent requests, and half-completed operations must never be committed to the database.

This project implements an atomic, concurrency-safe financial ledger architecture:
- **ACID Transactions:** Every balance modification and transaction document creation is executed inside a MongoDB multi-document session with `snapshot` read concern and `majority` write concern.
- **Atomic Balance Constraints:** Concurrency protection is enforced at the database engine level using conditional atomic operators (`{ _id: accountId, balance: { $gte: amountMinor } }` with `$inc`), completely eliminating race conditions and overdrafts.
- **Idempotency & Duplicate Prevention:** Duplicate reference IDs per account are strictly prohibited via a compound unique database index (`{ account_id: 1, reference_id: 1 }`).
- **Exact Monetary Precision:** Floating-point rounding errors are eradicated by manipulating and persisting all monetary values as integer minor units (paise/cents) internally, while cleanly formatting them as two-decimal strings in public API contracts.

---

## 2. Technology Stack

- **Runtime:** Node.js (v18+ / v20+ / v24+)
- **Language:** JavaScript (ES6+)
- **Web Framework:** Express.js 4.x
- **Database:** MongoDB 7.0 (Single-node replica set for multi-document ACID transactions)
- **Object Data Modeling (ODM):** Mongoose 8.x
- **Schema & Boundary Validation:** Zod
- **Environment Management:** dotenv
- **Automated Testing:** Jest & Supertest (with `mongodb-memory-server` in-memory replica set)
- **Containerization:** Docker & Docker Compose

---

## 3. Monetary Representation & Precision

Standard JavaScript IEEE 754 floating-point arithmetic introduces well-documented precision errors (e.g. `0.1 + 0.2 === 0.30000000000000004`). In financial engineering, this can result in catastrophic reconciliation failures.

### The Minor Unit Strategy:
1. **Internal Storage & Math:** Amounts are stored as **integer minor units** (e.g., \$1.00 = 100 minor units; ₹500.50 = 50,050 minor units).
   - Safe up to `Number.MAX_SAFE_INTEGER` ($90+ trillion).
   - All additions, subtractions, and database `$inc` operators execute on integers with zero precision loss.
2. **Boundary Validation:** Request bodies are validated using Zod regex `/^\d+(\.\d{1,2})?$/`, ensuring values are positive and have at most 2 decimal places.
3. **Public API Serialization:** Schema transforms and helper functions format minor unit integers back into fixed 2-decimal string format (e.g., `50000` -> `"500.00"`, `0` -> `"0.00"`).

---

## 4. Project Folder Structure

```text
confluencer/
├── src/
│   ├── app.js                          # Express application configuration & middleware pipeline
│   ├── server.js                       # HTTP server entry point & graceful shutdown
│   ├── config/
│   │   └── database.js                 # Mongoose connection and lifecycle management
│   ├── models/
│   │   ├── account.model.js            # Account schema, indexes & JSON serialization
│   │   └── transaction.model.js        # Transaction schema, compound indexes & serialization
│   ├── routes/
│   │   ├── account.routes.js           # Account endpoints router
│   │   └── transaction.routes.js       # Nested transactions router
│   ├── controllers/
│   │   ├── account.controller.js       # HTTP request/response handler for accounts
│   │   └── transaction.controller.js   # HTTP request/response handler for transactions
│   ├── services/
│   │   ├── account.service.js          # Core account business logic
│   │   └── transaction.service.js      # Concurrency-safe ACID transaction logic
│   ├── validators/
│   │   ├── account.validator.js        # Zod schemas for account requests
│   │   └── transaction.validator.js    # Zod schemas for transaction requests
│   ├── middleware/
│   │   ├── validate-request.js         # Zod schema validation middleware
│   │   ├── not-found.js                # 404 Route not found handler
│   │   └── error-handler.js            # Centralized error handler & status mapper
│   └── utils/
│       ├── app-error.js                # Operational AppError class
│       └── money.js                    # Minor unit conversion & formatting utilities
├── tests/
│   ├── setup.js                        # In-memory MongoMemoryReplSet configuration
│   ├── accounts.test.js                # Account integration tests (cases 1–7)
│   └── transactions.test.js            # Transaction integration & concurrency tests (cases 8–22)
├── .dockerignore
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

---

## 5. Prerequisites

- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **Docker & Docker Compose:** Optional for local development, recommended for containerized replica set setup.

---

## 6. Installation & Environment Configuration

### Step 1: Clone and install dependencies
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy the example environment file:
```bash
# On Linux / macOS
cp .env.example .env

# On Windows PowerShell
Copy-Item .env.example .env
```

Default `.env` configuration:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/ledger?replicaSet=rs0&directConnection=true
```

---

## 7. MongoDB Replica Set Setup

MongoDB multi-document transactions require a replica set. You can run one in any of the following three ways:

### Option A: Zero-Setup In-Memory Replica Set (Instant local testing)
If you don't have MongoDB or Docker running locally, you can start the API with an embedded in-memory MongoDB replica set with a single command:
```bash
npm run start:mem
```
This spins up an in-memory replica set and binds the API to `http://localhost:3000` with full multi-document transactions enabled!

### Option B: Automated via Docker Compose
Docker Compose spins up a single-node MongoDB replica set `rs0` with automated replica initialization:
```bash
docker compose up -d mongo
```

### Option C: Local MongoDB Service
If running standalone MongoDB locally on port 27017, start mongod with the replica set flag:
```bash
mongod --replSet rs0 --dbpath <data-directory>
```
Then initiate the replica set once via mongosh:
```javascript
mongosh --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] })'
```

### Option C: MongoDB Atlas (Free Cloud Cluster)
MongoDB Atlas clusters automatically run as replica sets out-of-the-box:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/ledger?retryWrites=true&w=majority
```

---

## 8. Running the Application

### Development mode (with auto-restart):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

### Complete stack with Docker Compose:
```bash
docker compose up --build
```

---

## 9. API Documentation & Curl Examples

### Summary of Available Endpoints

| Method | Endpoint | Description | Success Code |
|---|---|---|---|
| `POST` | `/api/accounts` | Create a new ledger account | `201 Created` |
| `POST` | `/api/accounts/:accountId/transactions` | Add a credit or debit transaction | `201 Created` |
| `GET` | `/api/accounts/:accountId/balance` | Retrieve current account balance | `200 OK` |
| `GET` | `/api/accounts/:accountId/transactions` | Retrieve sorted transaction history (with optional `?type=`) | `200 OK` |
| `POST` | `/api/transfers` | Transfer funds atomically between accounts (Bonus) | `200 OK` |

---

### Endpoint 1: Create Account

Initializes a new account with an authoritative, server-enforced `0.00` balance. Any client-provided `balance`, `id`, or `created_at` fields are strictly ignored.

- **URL:** `POST /api/accounts`
- **Headers:** `Content-Type: application/json`

#### Request:
```json
{
  "name": "Smit Prajapati"
}
```

#### Curl:
```bash
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{"name": "Smit Prajapati"}'
```

#### Response (`201 Created`):
```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "name": "Smit Prajapati",
    "balance": "0.00",
    "created_at": "2026-10-28T09:20:00.000Z",
    "id": "671f652b452097746cb98f01"
  }
}
```

---

### Endpoint 2: Add Transaction

Executes an atomic credit or debit transaction inside a MongoDB session.

- **URL:** `POST /api/accounts/:accountId/transactions`
- **Headers:** `Content-Type: application/json`

#### Request (Credit):
```json
{
  "type": "credit",
  "amount": 500,
  "description": "Salary deposit",
  "reference_id": "REF-001"
}
```

#### Curl (Credit):
```bash
curl -X POST http://localhost:3000/api/accounts/671f652b452097746cb98f01/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "type": "credit",
    "amount": 500,
    "description": "Salary deposit",
    "reference_id": "REF-001"
  }'
```

#### Response (`201 Created`):
```json
{
  "success": true,
  "message": "Transaction created successfully",
  "data": {
    "transaction": {
      "account_id": "671f652b452097746cb98f01",
      "type": "credit",
      "amount": "500.00",
      "description": "Salary deposit",
      "reference_id": "REF-001",
      "created_at": "2026-10-28T09:21:00.000Z",
      "id": "671f6567452097746cb98f05"
    },
    "balance": "500.00"
  }
}
```

#### Request (Debit):
```json
{
  "type": "debit",
  "amount": 120.50,
  "description": "Grocery purchase",
  "reference_id": "REF-002"
}
```

#### Curl (Debit):
```bash
curl -X POST http://localhost:3000/api/accounts/671f652b452097746cb98f01/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "type": "debit",
    "amount": 120.50,
    "description": "Grocery purchase",
    "reference_id": "REF-002"
  }'
```

#### Response (`201 Created`):
```json
{
  "success": true,
  "message": "Transaction created successfully",
  "data": {
    "transaction": {
      "account_id": "671f652b452097746cb98f01",
      "type": "debit",
      "amount": "120.50",
      "description": "Grocery purchase",
      "reference_id": "REF-002",
      "created_at": "2026-10-28T09:22:00.000Z",
      "id": "671f65a1452097746cb98f08"
    },
    "balance": "379.50"
  }
}
```

---

### Endpoint 3: Get Account Balance

Retrieves the current persisted ledger balance for an account.

- **URL:** `GET /api/accounts/:accountId/balance`

#### Curl:
```bash
curl -X GET http://localhost:3000/api/accounts/671f652b452097746cb98f01/balance
```

#### Response (`200 OK`):
```json
{
  "success": true,
  "data": {
    "account_id": "671f652b452097746cb98f01",
    "balance": "379.50"
  }
}
```

---

### Endpoint 4: Get Transaction History

Retrieves transaction records for an account sorted deterministically with newest transactions first (`created_at: -1, _id: -1`). Supports optional filtering by `type` (`credit` or `debit`).

- **URL:**
  - All: `GET /api/accounts/:accountId/transactions`
  - Credits only: `GET /api/accounts/:accountId/transactions?type=credit`
  - Debits only: `GET /api/accounts/:accountId/transactions?type=debit`

#### Curl:
```bash
curl -X GET "http://localhost:3000/api/accounts/671f652b452097746cb98f01/transactions?type=credit"
```

#### Response (`200 OK`):
```json
{
  "success": true,
  "data": [
    {
      "account_id": "671f652b452097746cb98f01",
      "type": "credit",
      "amount": "500.00",
      "description": "Salary deposit",
      "reference_id": "REF-001",
      "created_at": "2026-10-28T09:21:00.000Z",
      "id": "671f6567452097746cb98f05"
    }
  ]
}
```

---

### Endpoint 5: Transfer Funds (Bonus Feature)

Transfers money from a source account to a destination account within a single atomic multi-document transaction. If either the source debit or destination credit fails (e.g., insufficient funds or missing account), the entire operation rolls back. A partial transfer is mathematically and transactionally impossible.

- **URL:** `POST /api/transfers`
- **Headers:** `Content-Type: application/json`

#### Request:
```json
{
  "source_account_id": "671f652b452097746cb98f01",
  "destination_account_id": "671f652b452097746cb98f02",
  "amount": 30,
  "description": "Payment for services",
  "reference_id": "TRF-001"
}
```

#### Curl:
```bash
curl -X POST http://localhost:3000/api/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "source_account_id": "671f652b452097746cb98f01",
    "destination_account_id": "671f652b452097746cb98f02",
    "amount": 30,
    "description": "Payment for services",
    "reference_id": "TRF-001"
  }'
```

#### Response (`200 OK`):
```json
{
  "success": true,
  "message": "Funds transferred successfully",
  "data": {
    "source_account_id": "671f652b452097746cb98f01",
    "destination_account_id": "671f652b452097746cb98f02",
    "amount": "30.00",
    "source_balance": "70.00",
    "destination_balance": "80.00",
    "reference_id": "TRF-001",
    "source_transaction_id": "671f65a1452097746cb98f10",
    "destination_transaction_id": "671f65a1452097746cb98f11"
  }
}
```

---

## 10. Error Handling & Status Codes

All errors return a standardized JSON structure:

```json
{
  "success": false,
  "message": "<Error description>"
}
```

| HTTP Status | Reason | Example Scenario |
|---|---|---|
| `400 Bad Request` | Validation failure or insufficient balance | Attempting to debit more than the available balance; invalid amount; negative amount |
| `404 Not Found` | Resource does not exist | Account ID not found in database |
| `409 Conflict` | Duplicate transaction | Reference ID already exists for this account |
| `500 Internal Error` | Unexpected server failure | Database connection failure |

### Error Examples:

#### Insufficient Balance (`400 Bad Request`):
```json
{
  "success": false,
  "message": "Insufficient account balance"
}
```

#### Duplicate Reference ID (`409 Conflict`):
```json
{
  "success": false,
  "message": "Duplicate transaction detected. A transaction with this reference ID already exists for this account."
}
```

#### Non-existent Account (`404 Not Found`):
```json
{
  "success": false,
  "message": "Account not found"
}
```

#### Malformed Account ID (`400 Bad Request`):
```json
{
  "success": false,
  "message": "Invalid account ID format. Must be a 24-character hex string."
}
```

---

## 11. Concurrency, Atomicity & Data Integrity Guarantees

### 1. Atomic Multi-Document Transactions
Mongoose operations are encapsulated inside `session.startTransaction({ readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } })`. Both the Account balance increment/decrement and the Transaction document insertion occur within the same session. If either step fails or an unexpected exception is thrown, `session.abortTransaction()` is invoked, leaving the ledger untouched.

### 2. Preventing Race Conditions & Overdrafts
Simple read-then-write logic (`const acc = find(); if (acc.balance >= amt) update();`) is vulnerable to TOCTOU (Time-of-Check to Time-of-Use) race conditions where concurrent debits both read the same balance and overspend.

This system uses a **conditional atomic database update**:
```javascript
const updatedAccount = await Account.findOneAndUpdate(
  { _id: accountId, balance: { $gte: amountMinor } },
  { $inc: { balance: -amountMinor } },
  { session, new: true }
);
```
Under this atomic operator:
- The database engine checks `balance >= amountMinor` at the moment of modification.
- If two simultaneous debit requests of \$70 arrive on an account with \$100, exactly one will find the condition satisfied. The second will find 0 matching documents and immediately abort with `400 Insufficient account balance`.
- Account balance is guaranteed never to become negative.

### 3. Duplicate Prevention via Compound Indexes
A compound unique index is enforced at the database level:
```javascript
transactionSchema.index({ account_id: 1, reference_id: 1 }, { unique: true });
```
- Account A can use `REF-001`.
- Account B can also use `REF-001`.
- Account A attempting to submit `REF-001` a second time triggers MongoDB error code `11000`, which our transaction aborts and maps to HTTP `409 Conflict`.
- Simultaneous duplicate requests are automatically serialized and protected by this database constraint.

---

## 12. Automated Testing

The automated test suite uses **Jest** and **Supertest** with an isolated in-memory MongoDB replica set via `mongodb-memory-server` (`MongoMemoryReplSet`). This enables multi-document transaction testing without needing a running external database.

### Running the Automated Tests:
```bash
npm test
```

### Running the Live End-to-End Demo Script:
In one terminal, start the server:
```bash
npm run start:mem
```
In a second terminal, run the automated verification script:
```bash
npm run demo
```

### Testing with Postman:
A pre-configured [`postman_collection.json`](postman_collection.json) is provided in the project root:
1. Open Postman.
2. Click **Import** and select `postman_collection.json`.
3. All 10 requests (Health, Create Account, Balance, Credit, Debit, Overdraft Rejection, Duplicate Prevention, and Filtered History) are ready to execute! The account ID from request 2 is automatically captured and used in subsequent requests.

### Test Coverage Highlights (35 Total Passing Tests across 3 Test Suites):
- **Account tests (1–7):**
  - Successful account creation
  - Missing and empty name rejection
  - Strict zero initial balance confirmation
  - Rejection of client tampering with balance/IDs
  - Balance retrieval
  - 404 for non-existent accounts
  - 400 for malformed ObjectIds
- **Transaction tests (8–20):**
  - Accurate credit balance updates
  - Accurate debit balance updates
  - Rejection of overdraft debits with 400
  - Verification that rejected debits leave database state untouched
  - Rejection of duplicate `reference_id` per account with 409
  - Verification that duplicate attempts do not alter balance
  - Independent `reference_id` reuse across different accounts
  - Sorted retrieval of all transactions
  - Filtering by `type=credit` and `type=debit`
  - Rejection of invalid transaction types
  - Rejection of zero, negative, and invalid decimals (>2 places)
  - Rejection of malformed account IDs
- **Concurrency & Atomicity tests (21–22):**
  - Simultaneous concurrent debits exceeding account balance (verifies zero overdraft)
  - Simultaneous concurrent duplicate requests (verifies single execution and 409 Conflict)
- **Bonus Money Transfer tests:**
  - Multi-document atomic transfer between accounts (source debit, destination credit)
  - Verification that insufficient balance aborts entire transfer and changes neither balance
  - Non-existent source or destination account rejection (404)
  - Same source and destination rejection (400)
  - Duplicate transfer reference rejection (409)
  - Race condition safety under concurrent simultaneous transfers

---

## 13. Docker Containerization

### Dockerfile Features:
- Multi-stage-ready `node:20-alpine` base image for minimal footprint and low attack surface.
- Runs under unprivileged `node` user for security.
- Production-only dependency installation via `npm ci --only=production`.

### Building and Running:

#### Build image manually:
```bash
docker build -t transaction-ledger-api .
```

#### Run complete stack with Docker Compose:
```bash
docker compose up -d
```

#### Check logs:
```bash
docker compose logs -f api
```

#### Tear down containers and volumes:
```bash
docker compose down -v
```

---

## 14. Assumptions & Design Decisions

Where the assignment requirements did not dictate explicit implementation constraints, the following sensible and professional engineering decisions were adopted:

1. **Monetary Storage & Decimal Precision:**
   - **Decision:** Persisted internally as integer minor units (e.g., \$1.00 = 100 minor units; ₹500.50 = 50,050 minor units) and formatted back to fixed two-decimal strings (e.g. `"500.00"`) in JSON responses.
   - **Rationale:** JavaScript's binary floating point arithmetic (IEEE 754) introduces well-known precision artifacts (such as `0.1 + 0.2 === 0.30000000000000004`). Minor units guarantee 100% exact math up to $90+ trillion without rounding drift.

2. **Identifier Strategy:**
   - **Decision:** Used native 24-character hexadecimal MongoDB ObjectIds for both Accounts and Transactions.
   - **Rationale:** ObjectIds are globally unique, automatically timestamped, and index-optimized. For a clean public API contract, schemas map `_id` to `id` as a string and strip internal MongoDB fields (`_id`, `__v`).

3. **Transaction Ordering:**
   - **Decision:** Transaction history is sorted chronologically descending (`created_at: -1, _id: -1`), ensuring newest transactions are returned first deterministically.
   - **Rationale:** Financial users expect to see their most recent activity first. Deterministic secondary sorting on `_id` prevents ordering ambiguity when transactions share the same millisecond timestamp.

4. **Account ID Validation:**
   - **Decision:** Route parameters (`:accountId`) are validated using Zod regex (`/^[0-9a-fA-F]{24}$/`) before reaching the database.
   - **Rationale:** Malformed account IDs are rejected immediately with a friendly `400 Bad Request` instead of letting Mongoose throw internal database `CastError` exceptions.

5. **Client Input Sanitization:**
   - **Decision:** Any client-supplied `balance`, `id`, `_id`, or `created_at` fields sent during account or transaction creation are strictly stripped and ignored.
   - **Rationale:** In financial applications, initial balances, entity IDs, and ledger timestamps must remain exclusively server-authoritative.

6. **Zero-Setup Testing Environment:**
   - **Decision:** Configured `mongodb-memory-server` in the test suite and provided `npm run start:mem` alongside Docker Compose.
   - **Rationale:** MongoDB multi-document ACID transactions require a replica set. To ensure reviewers can run the test suite (`npm test`) or spin up the server with zero setup friction and without requiring local MongoDB or Docker daemons, an embedded in-memory wiredTiger replica set is provided.



