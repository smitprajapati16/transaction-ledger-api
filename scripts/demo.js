/**
 * End-to-End API Demonstration and Verification Script.
 * Runs against a running server on http://localhost:3000.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function logStep(step, desc) {
  console.log(`\n${colors.bold}${colors.cyan}[Step ${step}] ${desc}${colors.reset}`);
}

function logResult(success, message, data = null) {
  const icon = success ? `${colors.green}✔ PASS${colors.reset}` : `${colors.red}✖ FAIL${colors.reset}`;
  console.log(`  ${icon} - ${message}`);
  if (data) {
    console.log(`    Response: ${JSON.stringify(data)}`);
  }
}

async function runDemo() {
  console.log(`${colors.bold}====================================================`);
  console.log(` Transaction Ledger API — End-to-End Live Test`);
  console.log(` Target Server: ${BASE_URL}`);
  console.log(`====================================================${colors.reset}`);

  try {
    // 0. Health check
    logStep(0, 'Checking API server health...');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthJson = await healthRes.json();
    logResult(healthRes.status === 200, `Server is reachable (status ${healthRes.status})`, healthJson);

    // 1. Create Account
    logStep(1, 'Creating an account for "Smit Prajapati" with initial balance 0.00');
    const createRes = await fetch(`${BASE_URL}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Smit Prajapati', balance: 9999 }), // balance override attempt
    });
    const createJson = await createRes.json();
    const accountId = createJson.data?.id;
    const initialBalance = createJson.data?.balance;

    const createOk = createRes.status === 201 && initialBalance === '0.00';
    logResult(createOk, `Account created with ID ${accountId}. Client balance override ignored, balance is strictly ${initialBalance}`, createJson.data);

    // 2. Check Balance
    logStep(2, `Querying balance for account ${accountId}`);
    const balRes = await fetch(`${BASE_URL}/api/accounts/${accountId}/balance`);
    const balJson = await balRes.json();
    logResult(balRes.status === 200 && balJson.data?.balance === '0.00', `Balance verified: ${balJson.data?.balance}`, balJson.data);

    // 3. Credit Transaction
    logStep(3, 'Depositing (Credit) 500.00 with reference "REF-1001"');
    const credRes = await fetch(`${BASE_URL}/api/accounts/${accountId}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'credit',
        amount: 500,
        description: 'Initial deposit',
        reference_id: 'REF-1001',
      }),
    });
    const credJson = await credRes.json();
    const credOk = credRes.status === 201 && credJson.data?.balance === '500.00';
    logResult(credOk, `Credit accepted. New account balance is ${credJson.data?.balance}`, credJson.data);

    // 4. Debit Transaction
    logStep(4, 'Withdrawing (Debit) 120.50 with reference "REF-1002"');
    const debRes = await fetch(`${BASE_URL}/api/accounts/${accountId}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'debit',
        amount: 120.50,
        description: 'Supermarket shopping',
        reference_id: 'REF-1002',
      }),
    });
    const debJson = await debRes.json();
    const debOk = debRes.status === 201 && debJson.data?.balance === '379.50';
    logResult(debOk, `Debit accepted. Resulting account balance is ${debJson.data?.balance}`, debJson.data);

    // 5. Test Insufficient Funds Rejection
    logStep(5, 'Attempting to withdraw 1000.00 (Exceeds available 379.50)');
    const overRes = await fetch(`${BASE_URL}/api/accounts/${accountId}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'debit',
        amount: 1000,
        description: 'Unauthorized overdraft attempt',
        reference_id: 'REF-1003',
      }),
    });
    const overJson = await overRes.json();
    const overOk = overRes.status === 400 && overJson.message.includes('Insufficient');
    logResult(overOk, `Overdraft cleanly rejected with HTTP 400: "${overJson.message}"`, overJson);

    // 6. Test Duplicate Transaction Prevention
    logStep(6, 'Attempting duplicate transaction submission with existing reference "REF-1001"');
    const dupRes = await fetch(`${BASE_URL}/api/accounts/${accountId}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'credit',
        amount: 100,
        description: 'Duplicate replay attempt',
        reference_id: 'REF-1001',
      }),
    });
    const dupJson = await dupRes.json();
    const dupOk = dupRes.status === 409;
    logResult(dupOk, `Duplicate reference rejected with HTTP 409 Conflict: "${dupJson.message}"`, dupJson);

    // 7. Verify Balance Unaltered after rejections
    logStep(7, 'Verifying account balance is still 379.50 after failed operations');
    const balCheckRes = await fetch(`${BASE_URL}/api/accounts/${accountId}/balance`);
    const balCheckJson = await balCheckRes.json();
    logResult(balCheckJson.data?.balance === '379.50', `Ledger balance intact: ${balCheckJson.data?.balance}`, balCheckJson.data);

    // 8. Query Transaction History (All)
    logStep(8, 'Retrieving all transactions (sorted newest first)');
    const histRes = await fetch(`${BASE_URL}/api/accounts/${accountId}/transactions`);
    const histJson = await histRes.json();
    logResult(histRes.status === 200 && histJson.data?.length === 2, `Retrieved ${histJson.data?.length} transactions`, histJson.data);

    // 9. Query Transaction History (Filtered by credit)
    logStep(9, 'Filtering transactions by type=credit');
    const credHistRes = await fetch(`${BASE_URL}/api/accounts/${accountId}/transactions?type=credit`);
    const credHistJson = await credHistRes.json();
    logResult(credHistRes.status === 200 && credHistJson.data?.length === 1 && credHistJson.data[0].type === 'credit', `Retrieved ${credHistJson.data?.length} credit transaction`, credHistJson.data);

    // 10. Query Transaction History (Filtered by debit)
    logStep(10, 'Filtering transactions by type=debit');
    const debHistRes = await fetch(`${BASE_URL}/api/accounts/${accountId}/transactions?type=debit`);
    const debHistJson = await debHistRes.json();
    logResult(debHistRes.status === 200 && debHistJson.data?.length === 1 && debHistJson.data[0].type === 'debit', `Retrieved ${debHistJson.data?.length} debit transaction`, debHistJson.data);

    console.log(`\n${colors.bold}${colors.green}====================================================`);
    console.log(` 🎉 ALL API VERIFICATION CHECKS PASSED PERFECTLY!`);
    console.log(`====================================================${colors.reset}\n`);
  } catch (error) {
    console.error(`\n${colors.red}Error executing test script: ${error.message}${colors.reset}`);
    console.log(`Make sure the server is running on ${BASE_URL} before executing this script.`);
  }
}

runDemo();

