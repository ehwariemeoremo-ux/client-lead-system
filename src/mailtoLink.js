/**
 * Turns an email + subject + body into a clickable mailto: link that opens
 * the user's email app with everything pre-filled — they still review and
 * hit Send themselves.
 */
function buildMailtoLink(email, subject, body) {
  if (!email) return '';

  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);

  return `mailto:${email}?subject=${encodedSubject}&body=${encodedBody}`;
}

module.exports = { buildMailtoLink };
