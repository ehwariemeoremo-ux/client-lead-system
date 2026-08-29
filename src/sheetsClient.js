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
  'Website Quality',
  'Email Found',
  'Contact Method',
  'WhatsApp Draft Message',
  'WhatsApp Link (click to open pre-filled chat)',
  'Email Subject (draft)',
  'Email Body (draft)',
  'Email Link (click to open pre-filled email)',
  'Approved to Send? (type YES to send automatically)',
  'Email Sent Date (auto-filled)',
  'Follow-Up Count (auto-filled)',
  'Last Contacted Date (auto-filled)',
  'Gmail Thread ID (auto-filled, do not edit)',
  'Status (fill in yourself: Contacted / Replied / Won / Not Interested)',
  'Latest Reply Preview (auto-filled)',
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

  await writeHeaders(spreadsheetId, LEADS_TAB, LEADS_HEADERS);
  await writeHeaders(spreadsheetId, USED_LEADS_TAB, USED_LEADS_HEADERS);
  await applyLeadsFormatting(spreadsheetId);
}

async function writeHeaders(spreadsheetId, tabName, headers) {
  // Always overwrite row 1 with the current header set — this keeps the
  // sheet in sync if the code adds/renames columns later. Harmless to run
  // every time since it's just re-writing the same labels.
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [headers] },
  });
}

async function applyLeadsFormatting(spreadsheetId) {
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const leadsSheet = meta.data.sheets.find((s) => s.properties.title === LEADS_TAB);
  const sheetId = leadsSheet.properties.sheetId;
  const existingConditionalFormats = leadsSheet.conditionalFormats || [];

  const requests = [
    // Whole data area: white background, dark readable text, classic serif font
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1000 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 1, green: 1, blue: 1 },
            textFormat: { foregroundColor: { red: 0.1, green: 0.1, blue: 0.1 }, fontFamily: 'Georgia' },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    },
    // Header row: deep navy, bold white serif text
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.09, green: 0.13, blue: 0.24 },
            textFormat: {
              bold: true,
              fontFamily: 'Georgia',
              foregroundColor: { red: 1, green: 1, blue: 1 },
            },
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 46 },
        fields: 'pixelSize',
      },
    },
    // Freeze header row
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    // Make sure the Date column displays as a readable date, not a raw
    // serial number like "46261"
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
        cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' } } },
        fields: 'userEnteredFormat(numberFormat)',
      },
    },
    // Thin borders on the whole data area, like a proper report table
    {
      updateBorders: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 21 },
        top: { style: 'SOLID', width: 1, color: { red: 0.85, green: 0.85, blue: 0.85 } },
        bottom: { style: 'SOLID', width: 1, color: { red: 0.85, green: 0.85, blue: 0.85 } },
        left: { style: 'SOLID', width: 1, color: { red: 0.85, green: 0.85, blue: 0.85 } },
        right: { style: 'SOLID', width: 1, color: { red: 0.85, green: 0.85, blue: 0.85 } },
        innerHorizontal: { style: 'SOLID', width: 1, color: { red: 0.9, green: 0.9, blue: 0.9 } },
        innerVertical: { style: 'SOLID', width: 1, color: { red: 0.9, green: 0.9, blue: 0.9 } },
      },
    },
    // Wrap + top-align the long text columns (Business Name, Address, WhatsApp Draft Message, Email Body)
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 1, endColumnIndex: 2 },
        cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' } },
        fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 3, endColumnIndex: 4 },
        cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' } },
        fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 9, endColumnIndex: 10 },
        cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' } },
        fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 12, endColumnIndex: 13 },
        cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' } },
        fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 20, endColumnIndex: 21 },
        cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' } },
        fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)',
      },
    },
    // Center the shorter, categorical columns (Date, Category, Website Quality, Contact Method)
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
        cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
        fields: 'userEnteredFormat(horizontalAlignment)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 2, endColumnIndex: 3 },
        cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
        fields: 'userEnteredFormat(horizontalAlignment)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 6, endColumnIndex: 7 },
        cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
        fields: 'userEnteredFormat(horizontalAlignment)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 8, endColumnIndex: 9 },
        cell: { userEnteredFormat: { horizontalAlignment: 'CENTER', wrapStrategy: 'WRAP' } },
        fields: 'userEnteredFormat(horizontalAlignment,wrapStrategy)',
      },
    },
    // Sensible column widths
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 180 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 }, properties: { pixelSize: 220 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 }, properties: { pixelSize: 130 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 5, endIndex: 6 }, properties: { pixelSize: 130 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 6, endIndex: 7 }, properties: { pixelSize: 140 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 8, endIndex: 9 }, properties: { pixelSize: 150 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 9, endIndex: 10 }, properties: { pixelSize: 280 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 10, endIndex: 11 }, properties: { pixelSize: 130 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 11, endIndex: 12 }, properties: { pixelSize: 200 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 12, endIndex: 13 }, properties: { pixelSize: 280 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 13, endIndex: 14 }, properties: { pixelSize: 130 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 14, endIndex: 15 }, properties: { pixelSize: 160 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 15, endIndex: 16 }, properties: { pixelSize: 150 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 16, endIndex: 17 }, properties: { pixelSize: 110 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 17, endIndex: 18 }, properties: { pixelSize: 150 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 18, endIndex: 19 }, properties: { pixelSize: 130, hiddenByUser: true }, fields: 'pixelSize,hiddenByUser' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 20, endIndex: 21 }, properties: { pixelSize: 280 }, fields: 'pixelSize' } },
  ];

  // Only add zebra striping once — the formula-based rule automatically
  // applies to new rows too, so re-adding it on every run would just
  // create duplicate rules.
  if (existingConditionalFormats.length === 0) {
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 21 }],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=ISEVEN(ROW())' }] },
            format: { backgroundColor: { red: 0.95, green: 0.96, blue: 0.98 } },
          },
        },
        index: 0,
      },
    });
  }

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
}

async function appendLeadRow(spreadsheetId, rowValues) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${LEADS_TAB}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'OVERWRITE',
    requestBody: { values: [rowValues] },
  });
}

async function recordUsedLead(spreadsheetId, placeId, businessName, dateStr) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${USED_LEADS_TAB}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'OVERWRITE',
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
  getSheetsClientForRegenerate: getSheetsClient,
  LEADS_TAB,
  USED_LEADS_TAB,
};
