const { google } = require('googleapis');

const LEADS_TAB = 'Leads';
const USED_LEADS_TAB = 'Used Leads (do not edit)';

const LEADS_HEADERS = [
  'Date Found',
  'Business Name',
  'Category',
  'Address',
  'Phone',
  'Website',
  'Email Found',
  'Contact Method',
  'WhatsApp Draft Message',
  'WhatsApp Link (click to open pre-filled chat)',
  'Status (fill in yourself: Contacted / Replied / Won / Not Interested)',
];

const USED_LEADS_HEADERS = ['Place ID', 'Business Name', 'Date Added'];

async function getAuthClient() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return auth.getClient();
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth.getClient();
}

async function getSheetsClient() {
  const authClient = await getAuthClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

async function ensureSheetStructure(spreadsheetId) {
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTabs = meta.data.sheets.map((s) => s.properties.title);

  const requests = [];
  if (!existingTabs.includes(LEADS_TAB)) {
    requests.push({ addSheet: { properties: { title: LEADS_TAB } } });
  }
  if (!existingTabs.includes(USED_LEADS_TAB)) {
    requests.push({ addSheet: { properties: { title: USED_LEADS_TAB } } });
  }
  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }

  await writeHeadersIfMissing(spreadsheetId, LEADS_TAB, LEADS_HEADERS);
  await writeHeadersIfMissing(spreadsheetId, USED_LEADS_TAB, USED_LEADS_HEADERS);
  await applyLeadsFormatting(spreadsheetId);
}

async function writeHeadersIfMissing(spreadsheetId, tabName, headers) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A1:Z1`,
  });
  const hasHeaders = res.data.values && res.data.values.length > 0;
  if (!hasHeaders) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }
}

async function applyLeadsFormatting(spreadsheetId) {
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const leadsSheet = meta.data.sheets.find((s) => s.properties.title === LEADS_TAB);
  const sheetId = leadsSheet.properties.sheetId;

  const requests = [
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.11, green: 0.2, blue: 0.17 },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment)',
      },
    },
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 8, endColumnIndex: 10 },
        cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' } },
        fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 8, endIndex: 9 },
        properties: { pixelSize: 320 },
        fields: 'pixelSize',
      },
    },
  ];

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
}

async function appendLeadRow(spreadsheetId, rowValues) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${LEADS_TAB}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [rowValues] },
  });
}

async function recordUsedLead(spreadsheetId, placeId, businessName, dateStr) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${USED_LEADS_TAB}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[placeId, businessName, dateStr]] },
  });
}

async function getAllUsedPlaceIds(spreadsheetId) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${USED_LEADS_TAB}!A2:A`,
  });
  const rows = res.data.values || [];
  return new Set(rows.map((r) => r[0]));
}

module.exports = {
  ensureSheetStructure,
  appendLeadRow,
  recordUsedLead,
  getAllUsedPlaceIds,
  LEADS_TAB,
  USED_LEADS_TAB,
};
