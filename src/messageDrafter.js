// Uses Google's free Gemini API to draft a short, personalized WhatsApp
// or email pitch, tailored to what the lead actually needs — not a generic
// "get online" message for everyone.

const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Builds the specific "what to pitch" instruction based on the category's
 * pitchAngle and whether the business already has a website. Keeping this
 * separate from the main prompt makes it easy to add new angles later.
 */
function buildFallbackWhatsappMessage(businessName, hasWebsite, websiteQuality) {
  if (!hasWebsite) {
    return `Hi! I noticed ${businessName} doesn't have a website yet — I build websites and automation (like booking systems and content scheduling) for businesses like yours. Open to a quick chat?`;
  }

  if (websiteQuality === 'Broken Website') {
    return `Hi! I tried visiting ${businessName}'s website and it looks like it's down or not loading right now — that could be turning away customers before they even find you. I fix and rebuild sites like this, and also build automation (booking systems, content scheduling) for businesses like yours. Open to a quick chat?`;
  }

  if (websiteQuality === 'Outdated Website') {
    return `Hi! I checked out ${businessName}'s website and noticed it hasn't been updated in a while (it's missing mobile-friendly design, or showing an old date) — a modern refresh could help you convert more visitors into customers. I build sites and automation for businesses like yours. Open to a quick chat?`;
  }

  return `Hi! I checked out ${businessName}'s website but couldn't find a direct email listed — I build custom systems for businesses like yours, like WhatsApp assistants that handle customer questions automatically or inventory tools that alert you on low stock. I've already built and run similar automation (a content calendar system, for example). Open to a quick chat?`;
}

function buildFallbackEmailPitch(businessName, websiteQuality) {
  if (websiteQuality === 'Broken Website') {
    return {
      subject: `${businessName}'s website appears to be down`,
      body: `Hi there,\n\nI tried visiting ${businessName}'s website and it looks like it's not loading right now — that's likely costing you customers who give up before finding you. I fix and rebuild websites, and also build automation systems (like inventory alerts and content scheduling) for businesses like yours. Open to a quick chat about getting it back up and running properly?\n\nBest regards`,
    };
  }

  if (websiteQuality === 'Outdated Website') {
    return {
      subject: `A quick note on ${businessName}'s website`,
      body: `Hi there,\n\nI checked out ${businessName}'s website and noticed it looks like it hasn't been updated in a while (missing mobile-friendly design, or an old date shown on the page). A modern refresh could help turn more visitors into customers. I build websites and automation systems for businesses like yours. Open to a quick chat about what a refresh could look like?\n\nBest regards`,
    };
  }

  return {
    subject: `A system built for businesses like ${businessName}`,
    body: `Hi there,\n\nI noticed ${businessName} and wanted to reach out — I build custom websites and automation systems (like AI-driven customer response tools, inventory alerts, and content scheduling) for businesses like yours. I've already built and run similar systems, including a fully automated content calendar tool. Open to a quick chat about what might help your business?\n\nBest regards`,
  };
}
function buildPitchAngle(pitchAngle, hasWebsite, websiteQuality) {
  if (pitchAngle === 'contentAutomation') {
    return `This lead is a marketing/social media agency — they already manage content for clients, so don't pitch "getting online." Instead, mention you've personally built a working automated content calendar system that researches ideas, rotates them across content pillars, and auto-populates a full month of Instagram/Facebook/TikTok posts on a schedule — genuinely running today, not a concept. Offer to show them how it works or build a version for their team/clients.`;
  }

  if (hasWebsite && (websiteQuality === 'Broken Website' || websiteQuality === 'Outdated Website')) {
    const issue = websiteQuality === 'Broken Website'
      ? "their website appears to be down or not loading properly right now"
      : "their website looks like it hasn't been updated in a while (missing mobile-friendly design or showing an old copyright date)";
    return `You checked their website and noticed a specific problem: ${issue}. Point this out gently and specifically (not vaguely), and offer to rebuild/refresh it — mention this is exactly the kind of work you do, and that a modern, working site could be costing them customers otherwise.`;
  }

  if (hasWebsite) {
    return `This business already has a decent, working website, so don't pitch "getting online" or a website refresh — that would be redundant. Instead, pitch a specific custom system you build for businesses like theirs: either an AI-powered WhatsApp assistant that responds to customer questions and takes orders even when the owner is unavailable, or an inventory tracking system that alerts them when stock runs low and automatically follows up with customers about new arrivals. Pick whichever fits the business type better. Briefly note you've already built real automation systems (like a content calendar tool that runs itself) as proof you deliver, without overclaiming these specific new systems are pre-built products — frame them as custom work you build for clients.`;
  }

  return `This business has no website yet. Mention that, and offer to build them a proper website or sales funnel plus automation (like a booking system or content scheduling) — the kind of practical foundation that helps them look credible and save time day-to-day.`;
}

/**
 * Drafts a short WhatsApp message, tailored via pitchAngle + hasWebsite.
 */
async function draftWhatsappMessage({ businessName, category, hasWebsite = false, pitchAngle = 'general', websiteQuality = 'No Website' }) {
  const fallback = buildFallbackWhatsappMessage(businessName, hasWebsite, websiteQuality);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('  GEMINI_API_KEY missing — using a template WhatsApp message instead.');
    return { message: fallback, source: 'Template' };
  }

  const angle = buildPitchAngle(pitchAngle, hasWebsite, websiteQuality);

  const prompt = `Write a short, friendly, professional WhatsApp message (under 65 words) pitching custom software/automation services to a small business owner.

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
      return { message: fallback, source: 'Template' };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? { message: text.trim(), source: 'AI' } : { message: fallback, source: 'Template' };
  } catch (err) {
    console.warn(`  Gemini call failed for "${businessName}" — using a template message instead. ${err.message}`);
    return { message: fallback, source: 'Template' };
  }
}

/**
 * Drafts a short email pitch (subject + body), tailored via pitchAngle + hasWebsite.
 */
async function draftEmailPitch({ businessName, category, pitchAngle = 'general', websiteQuality = 'Decent Website' }) {
  const fallback = buildFallbackEmailPitch(businessName, websiteQuality);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('  GEMINI_API_KEY missing — using a template email instead.');
    return { ...fallback, source: 'Template' };
  }

  const angle = buildPitchAngle(pitchAngle, true, websiteQuality); // email leads always have a website (that's how we found their email)

  const prompt = `Write a short, professional cold outreach email pitching custom software/automation services to a small business owner.

Business name: ${businessName}
Business type: ${category}

Rules:
- Keep the body under 130 words
- Mention the business by name naturally in the first line
- ${angle}
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
      return { ...fallback, source: 'Template' };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const subjectMatch = text.match(/Subject:\s*(.+)/i);
    const bodyMatch = text.match(/Body:\s*([\s\S]+)/i);

    if (!subjectMatch || !bodyMatch) {
      return { ...fallback, source: 'Template' };
    }

    return {
      subject: subjectMatch[1].trim(),
      body: bodyMatch[1].trim(),
      source: 'AI',
    };
  } catch (err) {
    console.warn(`  Gemini call failed for "${businessName}" — using a template email instead. ${err.message}`);
    return { ...fallback, source: 'Template' };
  }
}

module.exports = { draftWhatsappMessage, draftEmailPitch };
