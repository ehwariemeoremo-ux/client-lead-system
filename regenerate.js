require('dotenv').config();
const { regenerateAllDrafts } = require('./src/regenerateDrafts');

async function main() {
  const spreadsheetId = process.env.LEADS_SHEET_ID;
  if (!spreadsheetId) {
    console.error('Missing LEADS_SHEET_ID in your .env file (or GitHub secret).');
    process.exit(1);
  }

  console.log('Regenerating AI drafts for existing leads that have not been sent yet...');
  await regenerateAllDrafts(spreadsheetId);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
