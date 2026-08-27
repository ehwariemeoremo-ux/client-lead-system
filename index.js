require('dotenv').config();
const { runLeadPipeline } = require('./src/leadPipeline');

async function main() {
  const spreadsheetId = process.env.LEADS_SHEET_ID;
  if (!spreadsheetId) {
    console.error('Missing LEADS_SHEET_ID in your .env file (or GitHub secret).');
    process.exit(1);
  }

  // Optional: node index.js --limit=30
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const resultsPerCategory = limitArg ? parseInt(limitArg.split('=')[1], 10) : 20;

  console.log(`Starting lead search — up to ${resultsPerCategory} businesses per category...`);
  await runLeadPipeline({ spreadsheetId, resultsPerCategory });
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
