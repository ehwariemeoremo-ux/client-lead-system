/**
 * Turns a phone number + message into a clickable wa.me link that opens
 * WhatsApp with the message already typed in — you just review and hit
 * Send. Nothing is sent automatically; a real person (you) still clicks.
 */
function buildWhatsappLink(internationalPhoneNumber, message) {
  if (!internationalPhoneNumber) return '';

  // wa.me needs just digits, no +, spaces, or dashes
  const digitsOnly = internationalPhoneNumber.replace(/[^\d]/g, '');
  const encodedMessage = encodeURIComponent(message);

  return `https://wa.me/${digitsOnly}?text=${encodedMessage}`;
}

module.exports = { buildWhatsappLink };
