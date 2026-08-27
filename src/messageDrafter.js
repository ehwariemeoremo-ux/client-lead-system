// Uses Google's free Gemini API to draft a short, personalized WhatsApp
// pitch message for a lead that has no website yet.

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Drafts a short WhatsApp message pitching web/automation services to a
 * business that currently has no website.
 */
async function draftWhatsappMessage({ businessName, category }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing from your environment/secrets.');
  }

  const prompt = `Write a short, friendly, professional WhatsApp message (under 60 words) introducing web design and automation services to a Nigerian business owner.

Business name: ${businessName}
Business type: ${category}

Rules:
- Mention the business by name naturally
- Note that you noticed they don't have a website yet
- Briefly mention you help businesses like theirs get an online presence and automate parts of their workflow (like a spa or salon booking system, or a content calendar)
- End with a soft, low-pressure question inviting a reply (not a hard sell)
- No emojis, no hashtags, no generic filler like "I hope this message finds you well"
- Output ONLY the message text, nothing else`;

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? text.trim() : `Hi! I noticed ${businessName} doesn't have a website yet — I help businesses like yours get online and automate day-to-day tasks. Open to a quick chat?`;
}

module.exports = { draftWhatsappMessage };
