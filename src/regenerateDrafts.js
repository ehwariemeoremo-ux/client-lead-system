const { draftWhatsappMessage, draftEmailPitch } = require('./messageDrafter');
const { buildWhatsappLink } = require('./whatsappLink');
const { buildMailtoLink } = require('./mailtoLink');
const { getSheetsClientForRegenerate, LEADS_TAB } = require('./sheetsClient');
const categories = require('../config/categories');

function findPitchAngle(categoryName) {
  const match = categories.find((c) => c.name === categoryName);
  return match ? match.pitchAngle : 'general';
}

/**
 * Re-drafts the WhatsApp/email message for every existing row that hasn't
 * been sent yet — useful when earlier drafts came out as fallback templates
 * (e.g. because the daily AI quota ran out) and you want real AI-personalized
 * text instead, without re-searching for new businesses.
 */
async function regenerateAllDrafts(spreadsheetId) {
  const sheets = await getSheetsClientForRegenerate();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${LEADS_TAB}!A2:V`,
  });
  const rows = res.data.values || [];

  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // +2 because row 1 is the header, and i is 0-indexed

    const businessName = row[1];
    const categoryName = row[2];
    const websiteQuality = row[6] || 'No Website';
    const emailFound = row[7];
    const contactMethod = row[8] || '';
    const emailSentDate = row[15];

    if (!businessName) continue; // blank row, skip

    if (emailSentDate) {
      skipped += 1;
      continue; // already sent — never touch a message that's gone out
    }

    const pitchAngle = findPitchAngle(categoryName);
    let whatsappDraft = '';
    let whatsappLinkCell = '';
    let emailSubject = '';
    let emailBody = '';
    let emailLinkCell = '';
    let messageSource = '';

    try {
      if (contactMethod === 'Email' && emailFound) {
        const pitch = await draftEmailPitch({
          businessName,
          category: categoryName,
          pitchAngle,
          websiteQuality,
        });
        emailSubject = pitch.subject;
        emailBody = pitch.body;
        messageSource = pitch.source;
        const emailLink = buildMailtoLink(emailFound, emailSubject, emailBody);
        emailLinkCell = `=HYPERLINK("${emailLink}","Open Email Draft")`;
      } else if (contactMethod.indexOf('WhatsApp') === 0) {
        const phoneRaw = row[4] || '';
        const phone = phoneRaw.replace(/^'/, ''); // strip the text-forcing apostrophe if present
        const hasWebsite = contactMethod.indexOf('website has no listed email') !== -1;

        const draft = await draftWhatsappMessage({
          businessName,
          category: categoryName,
          hasWebsite,
          pitchAngle,
          websiteQuality,
        });
        whatsappDraft = draft.message;
        messageSource = draft.source;
        const whatsappLink = buildWhatsappLink(phone, whatsappDraft);
        whatsappLinkCell = `=HYPERLINK("${whatsappLink}","Open WhatsApp Chat")`;
      } else {
        skipped += 1;
        continue; // no website/phone lead — nothing to regenerate
      }

      // Overwrite the 5 message-related columns (J through N), leaving
      // Approved to Send / Email Sent Date / Follow-Up tracking / Thread ID /
      // Status / Latest Reply Preview completely untouched.
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${LEADS_TAB}!J${rowNumber}:N${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[whatsappDraft, whatsappLinkCell, emailSubject, emailBody, emailLinkCell]],
        },
      });

      // Also update the Message Source column (V) to reflect this fresh draft
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${LEADS_TAB}!V${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[messageSource]] },
      });

      updated += 1;
      console.log(`  Regenerated: ${businessName} (${messageSource})`);

      // Small pause between AI calls, matching the pacing used elsewhere
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
      console.error(`  Failed to regenerate "${businessName}": ${err.message}`);
    }
  }

  console.log(`\nDone. Regenerated: ${updated}. Skipped (already sent or no contact method): ${skipped}.`);
  return { updated, skipped };
}

module.exports = { regenerateAllDrafts };
