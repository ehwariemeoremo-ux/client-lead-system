// === Lead Email Automation ===
// This runs INSIDE your Leads Google Sheet (via Extensions > Apps Script),
// not on GitHub. It uses your own Gmail account to send emails — no
// external tool or subscription needed.
//
// What it does, every time it runs:
// 1. Checks already-sent leads for replies, and marks Status as "Replied"
// 2. Sends up to DAILY_SEND_LIMIT new emails, but ONLY for rows where you
//    typed "YES" in the "Approved to Send?" column — nothing sends without
//    your explicit go-ahead.

// Column positions (0-indexed) — must match the order of headers in the
// "Leads" tab exactly. If you ever add/reorder columns, update this too.
var COLUMNS = {
  DATE_FOUND: 0,
  BUSINESS_NAME: 1,
  CATEGORY: 2,
  ADDRESS: 3,
  PHONE: 4,
  WEBSITE: 5,
  WEBSITE_QUALITY: 6,
  EMAIL_FOUND: 7,
  CONTACT_METHOD: 8,
  WHATSAPP_DRAFT: 9,
  WHATSAPP_LINK: 10,
  EMAIL_SUBJECT: 11,
  EMAIL_BODY: 12,
  EMAIL_LINK: 13,
  APPROVED_TO_SEND: 14,
  EMAIL_SENT_DATE: 15,
  FOLLOWUP_COUNT: 16,
  LAST_CONTACTED_DATE: 17,
  GMAIL_THREAD_ID: 18,
  STATUS: 19,
  LATEST_REPLY_PREVIEW: 20,
};

// Change this number to send more/fewer NEW emails per day.
var DAILY_SEND_LIMIT = 5;

// Follow-up settings: how many days to wait before nudging an unanswered
// lead, and the maximum number of follow-ups to send before giving up.
var FOLLOWUP_WAIT_DAYS = 4;
var MAX_FOLLOWUPS = 2;
var DAILY_FOLLOWUP_LIMIT = 5;

var FOLLOWUP_TEMPLATES = [
  "Hi again — just floating this back to the top of your inbox in case it got buried under other things. Happy to answer any questions, or we could hop on a quick call if that's easier. No worries at all if now isn't the right time.",
  "One last follow-up from me — I don't want to keep bothering you if the timing isn't right, so this will be my final check-in. If you're interested down the line, feel free to reach out anytime.",
];

var SHEET_NAME = 'Leads';

/**
 * The main function — this is what the daily trigger calls.
 * Checks for replies first, then sends today's batch of approved emails.
 */
function dailyEmailAutomation() {
  checkForReplies();
  sendApprovedEmails();
  sendFollowUps();
}

/**
 * Sends emails for any row where:
 * - "Approved to Send?" is YES
 * - It hasn't already been sent
 * - There's a real email address, subject, and body to send
 * Stops once DAILY_SEND_LIMIT is reached, so it doesn't send everything
 * in one big burst.
 */
function sendApprovedEmails() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var sentCount = 0;

  for (var i = 1; i < data.length; i++) {
    // skip header row
    if (sentCount >= DAILY_SEND_LIMIT) break;

    var row = data[i];
    var approved = String(row[COLUMNS.APPROVED_TO_SEND]).trim().toUpperCase();
    var alreadySent = row[COLUMNS.EMAIL_SENT_DATE];
    var email = row[COLUMNS.EMAIL_FOUND];
    var subject = row[COLUMNS.EMAIL_SUBJECT];
    var body = row[COLUMNS.EMAIL_BODY];

    if (approved === 'YES' && !alreadySent && email && subject && body) {
      try {
        // Creating a draft first (instead of GmailApp.sendEmail directly)
        // lets us capture the resulting thread ID, which we need later to
        // check for replies.
        var draft = GmailApp.createDraft(email, subject, body);
        var sentMessage = draft.send();
        var threadId = sentMessage.getThread().getId();

        sheet.getRange(i + 1, COLUMNS.EMAIL_SENT_DATE + 1).setValue(new Date());
        sheet.getRange(i + 1, COLUMNS.LAST_CONTACTED_DATE + 1).setValue(new Date());
        sheet.getRange(i + 1, COLUMNS.GMAIL_THREAD_ID + 1).setValue(threadId);
        sheet.getRange(i + 1, COLUMNS.STATUS + 1).setValue('Contacted');

        sentCount += 1;

        // A short pause between sends — small, human-like pacing rather
        // than firing everything in the same instant.
        Utilities.sleep(3000);
      } catch (err) {
        sheet.getRange(i + 1, COLUMNS.STATUS + 1).setValue('Send failed: ' + err.message);
      }
    }
  }

  Logger.log('Sent ' + sentCount + ' email(s) today.');
}

/**
 * For leads that were emailed but haven't replied, sends a polite follow-up
 * after FOLLOWUP_WAIT_DAYS have passed since the last contact — up to
 * MAX_FOLLOWUPS times total, then stops on its own. Uses simple template
 * text (not AI) so this never touches your Gemini quota.
 */
function sendFollowUps() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var followUpsSent = 0;
  var now = new Date();

  for (var i = 1; i < data.length; i++) {
    if (followUpsSent >= DAILY_FOLLOWUP_LIMIT) break;

    var row = data[i];
    var threadId = row[COLUMNS.GMAIL_THREAD_ID];
    var status = String(row[COLUMNS.STATUS]).trim();
    var followUpCount = parseInt(row[COLUMNS.FOLLOWUP_COUNT], 10) || 0;
    var lastContactedRaw = row[COLUMNS.LAST_CONTACTED_DATE] || row[COLUMNS.EMAIL_SENT_DATE];

    var alreadyHandled = ['Replied', 'Won', 'Not Interested'].indexOf(status) !== -1;
    var reachedMax = followUpCount >= MAX_FOLLOWUPS;

    if (!threadId || alreadyHandled || reachedMax || !lastContactedRaw) continue;

    var lastContactedDate = new Date(lastContactedRaw);
    var daysSinceContact = (now - lastContactedDate) / (1000 * 60 * 60 * 24);

    if (daysSinceContact >= FOLLOWUP_WAIT_DAYS) {
      try {
        var thread = GmailApp.getThreadById(threadId);
        var followUpText = FOLLOWUP_TEMPLATES[followUpCount] || FOLLOWUP_TEMPLATES[FOLLOWUP_TEMPLATES.length - 1];
        thread.reply(followUpText);

        sheet.getRange(i + 1, COLUMNS.FOLLOWUP_COUNT + 1).setValue(followUpCount + 1);
        sheet.getRange(i + 1, COLUMNS.LAST_CONTACTED_DATE + 1).setValue(now);
        sheet.getRange(i + 1, COLUMNS.STATUS + 1).setValue('Followed up (' + (followUpCount + 1) + ')');

        followUpsSent += 1;
        Utilities.sleep(3000);
      } catch (err) {
        // Thread may be inaccessible — skip quietly and try again next run
      }
    }
  }

  Logger.log('Sent ' + followUpsSent + ' follow-up(s) today.');
}

/**
 * For every lead that's already been emailed, checks whether their Gmail
 * thread now has more than one message (meaning they replied), and marks
 * the Status column accordingly. Skips leads already marked Replied/Won/Not
 * Interested so it doesn't overwrite your own manual updates.
 */
function checkForReplies() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var threadId = row[COLUMNS.GMAIL_THREAD_ID];
    var currentStatus = String(row[COLUMNS.STATUS]).trim();

    var alreadyHandled = ['Replied', 'Won', 'Not Interested'].indexOf(currentStatus) !== -1;

    if (threadId && !alreadyHandled) {
      try {
        var thread = GmailApp.getThreadById(threadId);
        if (thread && thread.getMessageCount() > 1) {
          sheet.getRange(i + 1, COLUMNS.STATUS + 1).setValue('Replied');

          // Pull the most recent message in the thread (the client's reply)
          // and drop a short preview of it directly into the Sheet, so you
          // can glance at it without opening Gmail.
          var messages = thread.getMessages();
          var latestMessage = messages[messages.length - 1];
          var replyText = latestMessage.getPlainBody().trim();
          var preview = replyText.length > 300 ? replyText.substring(0, 300) + '...' : replyText;
          sheet.getRange(i + 1, COLUMNS.LATEST_REPLY_PREVIEW + 1).setValue(preview);
        }
      } catch (err) {
        // Thread may have been deleted/moved on Gmail's side — skip quietly
      }
    }
  }

  Logger.log('Reply check complete.');
}
