// Visits a business's website and looks for a publicly listed email address.
// This only reads publicly visible page text — it never logs in, submits
// forms, or accesses anything private.

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// A mailto: link is a much stronger signal than a plain-text email found
// anywhere on the page — the site owner deliberately made it clickable as
// a contact method, so we check for this first.
const MAILTO_REGEX = /href=["']mailto:([^"'?]+)/gi;

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
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow',
    });
    if (!response.ok) return '';
    return await response.text();
  } catch (err) {
    return '';
  }
}

/**
 * Checks a page's raw HTML for a real contact email, checking mailto:
 * links first (a much more reliable signal than a plain-text scan), then
 * falling back to scanning visible text for anything email-shaped.
 */
function extractEmailFromHtml(html) {
  const mailtoMatches = [...html.matchAll(MAILTO_REGEX)].map((m) => decodeURIComponent(m[1]));
  const validMailto = mailtoMatches.find(isLikelyRealEmail);
  if (validMailto) return validMailto;

  const matches = html.match(EMAIL_REGEX) || [];
  return matches.find(isLikelyRealEmail) || null;
}

/**
 * Tries the homepage first, then several common contact-style pages.
 * Returns the first plausible email found, or null.
 *
 * Known limitation: sites that render their contact info entirely with
 * JavaScript (common on some modern site builders) won't show that content
 * in the raw HTML this fetches, so a genuinely-listed email can still be
 * missed. Solving that fully would require a headless browser, which this
 * lightweight script intentionally doesn't use.
 */
async function findEmailOnWebsite(websiteUrl) {
  if (!websiteUrl) return null;

  const cleanBase = websiteUrl.replace(/\/$/, '');
  const pagesToTry = [
    cleanBase,
    `${cleanBase}/contact`,
    `${cleanBase}/contact-us`,
    `${cleanBase}/contacts`,
    `${cleanBase}/contact-us/`,
    `${cleanBase}/get-in-touch`,
    `${cleanBase}/about`,
    `${cleanBase}/about-us`,
  ];

  for (const pageUrl of pagesToTry) {
    const html = await fetchPageText(pageUrl);
    if (!html) continue;

    const found = extractEmailFromHtml(html);
    if (found) return found;
  }

  return null;
}

module.exports = { findEmailOnWebsite };
