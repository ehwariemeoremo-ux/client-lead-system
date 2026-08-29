// Visits a business's website and looks for a publicly listed email address.
// This only reads publicly visible page text — it never logs in, submits
// forms, or accesses anything private.

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Common false positives we never want to treat as a real contact email
// (placeholder addresses baked into website builder templates, tracking
// scripts, image filenames that look like emails, etc.)
const IGNORE_PATTERNS = [
  /wixpress\.com$/i,
  /sentry\.io$/i,
  /example\.com$/i,
  /\.(png|jpg|jpeg|gif|svg|webp)$/i,
  /godaddy\.com$/i,
  /^example@/i, // catches "example@email.com" and similar placeholders
  /^(test|demo|placeholder|yourname|youremail|name)@/i,
  /^[a-z]+@(email|domain|yourdomain|company)\.(com|net)$/i,
];

function isLikelyRealEmail(email) {
  return !IGNORE_PATTERNS.some((pattern) => pattern.test(email));
}

async function fetchPageText(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadResearchBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return '';
    return await response.text();
  } catch (err) {
    return '';
  }
}

/**
 * Tries the homepage first, then a "/contact" style page if nothing is
 * found. Returns the first plausible email found, or null.
 */
async function findEmailOnWebsite(websiteUrl) {
  if (!websiteUrl) return null;

  const cleanBase = websiteUrl.replace(/\/$/, '');
  const pagesToTry = [
    cleanBase,
    `${cleanBase}/contact`,
    `${cleanBase}/contact-us`,
    `${cleanBase}/about`,
  ];

  for (const pageUrl of pagesToTry) {
    const html = await fetchPageText(pageUrl);
    if (!html) continue;

    const matches = html.match(EMAIL_REGEX) || [];
    const validMatch = matches.find(isLikelyRealEmail);
    if (validMatch) {
      return validMatch;
    }
  }

  return null;
}

module.exports = { findEmailOnWebsite };
