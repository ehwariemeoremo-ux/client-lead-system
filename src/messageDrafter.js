// Uses Google's free Gemini API to draft a short, personalized WhatsApp
// pitch message for a lead that has no website yet.

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Drafts a short WhatsApp message pitching web/automation services to a
 * business that currently has no website.
 */
async function draftWhatsappMessage({ businessName, category, hasWebsite = false }) {
  const fallback = hasWebsite
    ? `Hi! I visited ${businessName}'s website but couldn't find a direct email — I help businesses like yours build sites and automation (bookings, content calendars) that make it easier for customers to reach you. Open to a quick chat?`
    : `Hi! I noticed ${businessName} doesn't have a website yet — I help businesses like yours get online and automate day-to-day tasks. Open to a quick chat?`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('  GEMINI_API_KEY missing — using a template WhatsApp message instead.');
    return fallback;
  }

  const angle = hasWebsite
    ? "Note that you checked out their website but couldn't find a clear way to contact them by email — offer to help make their site easier for customers to reach them through, and mention you also build automation (like booking systems or content calendars) for businesses like theirs."
    : "Note that you noticed they don't have a website yet. Briefly mention you help businesses like theirs get an online presence and automate parts of their workflow (like a booking system or a content calendar).";

  const prompt = `Write a short, friendly, professional WhatsApp message (under 60 words) introducing web design and automation services to a Nigerian business owner.

Business name: ${businessName}
Business type: ${category}

Rules:
- Mention the business by name naturally
- ${angle}
- End with a soft, low-pressure question inviting a reply (not a hard sell)
- No emojis, no hashtags, no generic filler like "I hope this message finds you well"
- Output ONLY the message text, nothing else`;

  try {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(`  Gemini API error (${response.status}) for "${businessName}" — using a template message instead. ${errorBody.slice(0, 200)}`);
      return fallback;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : fallback;
  } catch (err) {
    console.warn(`  Gemini call failed for "${businessName}" — using a template message instead. ${err.message}`);
    return fallback;
  }
}

/**
 * Drafts a short email pitch (subject + body) for a business we found a
 * real contact email for.
 */
async function draftEmailPitch({ businessName, category }) {
  const fallback = {
    subject: `Helping ${businessName} grow online`,
    body: `Hi there,\n\nI noticed ${businessName} and wanted to reach out — I help businesses like yours with websites, sales funnels, and automation (like booking systems and content scheduling). Open to a quick chat?\n\nBest regards`,
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('  GEMINI_API_KEY missing — using a template email instead.');
    return fallback;
  }

  const prompt = `Write a short, professional cold outreach email pitching web design and automation services to a Nigerian business owner.

Business name: ${businessName}
Business type: ${category}

Rules:
- Keep the body under 120 words
- Mention the business by name naturally in the first line
- Briefly explain you help businesses like theirs with websites, sales funnels, and automation (e.g. booking systems, content calendar automation)
- End with a soft, low-pressure call to action inviting a reply or a short call
- No emojis, no hashtags, no generic filler like "I hope this email finds you well"
- Respond ONLY in this exact format, nothing else:
Subject: <subject line here>
Body: <email body here>`;

  try {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(`  Gemini API error (${response.status}) for "${businessName}" — using a template email instead. ${errorBody.slice(0, 200)}`);
      return fallback;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const subjectMatch = text.match(/Subject:\s*(.+)/i);
    const bodyMatch = text.match(/Body:\s*([\s\S]+)/i);

    return {
      subject: subjectMatch ? subjectMatch[1].trim() : fallback.subject,
      body: bodyMatch ? bodyMatch[1].trim() : fallback.body,
    };
  } catch (err) {
    console.warn(`  Gemini call failed for "${businessName}" — using a template email instead. ${err.message}`);
    return fallback;
  }
}

module.exports = { draftWhatsappMessage, draftEmailPitch };
