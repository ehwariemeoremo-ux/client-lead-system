// Does a lightweight check on a business's website to classify it as
// Broken / Outdated / Decent — used to pick the right pitch angle, matching
// the original 3-tier plan (No Website / Outdated / Decent).

async function checkWebsiteQuality(websiteUrl) {
  if (!websiteUrl) return 'No Website';

  let html = '';
  try {
    const response = await fetch(websiteUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadResearchBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return 'Broken Website';
    }
    html = await response.text();
  } catch (err) {
    return 'Broken Website';
  }

  if (!html || html.length < 200) {
    return 'Broken Website';
  }

  // Signal 1: no mobile-friendly viewport tag — a strong sign of an old site
  const hasViewportTag = /<meta[^>]+name=["']viewport["']/i.test(html);

  // Signal 2: an old copyright year baked into the page
  const copyrightMatch = html.match(/(?:©|copyright)\s*(\d{4})/i);
  const currentYear = new Date().getFullYear();
  const hasOldCopyright = copyrightMatch && (currentYear - parseInt(copyrightMatch[1], 10) >= 4);

  if (!hasViewportTag || hasOldCopyright) {
    return 'Outdated Website';
  }

  return 'Decent Website';
}

module.exports = { checkWebsiteQuality };
