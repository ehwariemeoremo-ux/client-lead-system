const { searchBusinesses } = require('./placesClient');
const { findEmailOnWebsite } = require('./emailScraper');
const { draftWhatsappMessage, draftEmailPitch } = require('./messageDrafter');
const { buildWhatsappLink } = require('./whatsappLink');
const { buildMailtoLink } = require('./mailtoLink');
const {
  ensureSheetStructure,
  appendLeadRow,
  recordUsedLead,
  getAllUsedPlaceIds,
} = require('./sheetsClient');
const categories = require('../config/categories');

const todayStr = () => new Date().toISOString().split('T')[0];

/**
 * Runs the full pipeline: search each category, skip already-seen
 * businesses, enrich each new lead (email or WhatsApp draft), and write
 * everything into the Sheet.
 */
async function runLeadPipeline({ spreadsheetId, resultsPerCategory = 20 }) {
  await ensureSheetStructure(spreadsheetId);
  const usedPlaceIds = await getAllUsedPlaceIds(spreadsheetId);

  const summary = { found: 0, skippedDuplicates: 0, errors: [] };

  for (const category of categories) {
    console.log(`\n--- Searching category: ${category.name} ---`);

    let businesses = [];
    try {
      businesses = await searchBusinesses(category.searchTerm, resultsPerCategory);
    } catch (err) {
      console.error(`  Failed to search "${category.name}": ${err.message}`);
      summary.errors.push(`${category.name}: ${err.message}`);
      continue;
    }

    for (const business of businesses) {
      if (usedPlaceIds.has(business.placeId)) {
        summary.skippedDuplicates += 1;
        continue;
      }

      console.log(`  New lead: ${business.name}`);

      let email = null;
      let whatsappDraft = '';
      let whatsappLink = '';
      let emailSubject = '';
      let emailBody = '';
      let emailLink = '';
      let contactMethod = 'Unknown';

      try {
        if (business.website) {
          email = await findEmailOnWebsite(business.website);
          if (email) {
            contactMethod = 'Email';
            const pitch = await draftEmailPitch({
              businessName: business.name,
              category: category.name,
            });
            emailSubject = pitch.subject;
            emailBody = pitch.body;
            emailLink = buildMailtoLink(email, emailSubject, emailBody);
          } else if (business.phone) {
            // Has a website, but no findable email — fall back to WhatsApp
            whatsappDraft = await draftWhatsappMessage({
              businessName: business.name,
              category: category.name,
              hasWebsite: true,
            });
            whatsappLink = buildWhatsappLink(business.phone, whatsappDraft);
            contactMethod = 'WhatsApp (website has no listed email)';
          } else {
            contactMethod = 'Website found, but no email or phone';
          }
        } else if (business.phone) {
          whatsappDraft = await draftWhatsappMessage({
            businessName: business.name,
            category: category.name,
            hasWebsite: false,
          });
          whatsappLink = buildWhatsappLink(business.phone, whatsappDraft);
          contactMethod = 'WhatsApp (no website)';
        } else {
          contactMethod = 'No website or phone found';
        }
      } catch (err) {
        console.error(`    Enrichment failed for ${business.name}: ${err.message}`);
        summary.errors.push(`${business.name}: ${err.message}`);
      }

      // A leading apostrophe forces Google Sheets to treat the phone number
      // as plain text, so a number starting with "+" doesn't get
      // misread as the start of a formula (this was causing #ERROR!).
      const phoneAsText = business.phone ? `'${business.phone}` : '';

      // Use HYPERLINK formulas so the sheet shows short, clean clickable
      // labels instead of long raw URLs cluttering every row.
      const websiteCell = business.website
        ? `=HYPERLINK("${business.website}","Visit Website")`
        : 'None';
      const whatsappCell = whatsappLink
        ? `=HYPERLINK("${whatsappLink}","Open WhatsApp Chat")`
        : '';
      const emailLinkCell = emailLink
        ? `=HYPERLINK("${emailLink}","Open Email Draft")`
        : '';

      await appendLeadRow(spreadsheetId, [
        todayStr(),
        business.name,
        category.name,
        business.address,
        phoneAsText,
        websiteCell,
        email || '',
        contactMethod,
        whatsappDraft,
        whatsappCell,
        emailSubject,
        emailBody,
        emailLinkCell,
        '', // Status - left blank for the user to fill in
      ]);

      await recordUsedLead(spreadsheetId, business.placeId, business.name, todayStr());
      usedPlaceIds.add(business.placeId);
      summary.found += 1;
    }
  }

  console.log(`\nDone. New leads added: ${summary.found}. Duplicates skipped: ${summary.skippedDuplicates}.`);
  if (summary.errors.length) {
    console.log(`Errors encountered: ${summary.errors.length}`);
    summary.errors.forEach((e) => console.log(`  - ${e}`));
  }

  return summary;
}

module.exports = { runLeadPipeline };
