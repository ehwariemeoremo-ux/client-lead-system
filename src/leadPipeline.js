const { searchBusinesses } = require('./placesClient');
const { findEmailOnWebsite } = require('./emailScraper');
const { draftWhatsappMessage } = require('./messageDrafter');
const { buildWhatsappLink } = require('./whatsappLink');
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
      let contactMethod = 'Unknown';

      try {
        if (business.website) {
          email = await findEmailOnWebsite(business.website);
          contactMethod = email ? 'Email' : 'Website (no email found)';
        } else if (business.phone) {
          whatsappDraft = await draftWhatsappMessage({
            businessName: business.name,
            category: category.name,
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

      await appendLeadRow(spreadsheetId, [
        todayStr(),
        business.name,
        category.name,
        business.address,
        business.phone,
        business.website || 'None',
        email || '',
        contactMethod,
        whatsappDraft,
        whatsappLink,
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
