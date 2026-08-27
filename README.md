# Client Lead Finder — Setup Guide

This system automatically finds potential clients (gyms, boutiques, restaurants,
salons across Nigeria) every week, and preps outreach for each one:

- **Business has a website** → it tries to find a public contact email on their site
- **Business has no website** → it drafts a personalized WhatsApp message and
  gives you a ready-to-click link that opens WhatsApp with the message already
  typed in. You still click "Send" yourself — nothing is sent automatically.

Everything lands in a Google Sheet, one row per lead, with a "Status" column
you fill in yourself (Contacted / Replied / Won / Not Interested).

It reuses the **same Google Cloud project, service account, and Gemini API
key** from your content calendar project — you're not starting from scratch.

---

## What you need before starting

- [ ] Your existing `service-account-key.json` file (from the content calendar setup)
- [ ] Your existing free Gemini API key
- [ ] A new, blank Google Sheet (separate from your content calendar one) — this keeps leads and content completely separate

---

## Step 1 — Create the Leads Google Sheet

1. Go to sheets.google.com and create a new blank sheet. Name it something like "Client Leads".
2. Share it with your service account email (the same `...iam.gserviceaccount.com` email you used before) — give it **Editor** access.
3. Copy the Sheet ID from the URL (the long string between `/d/` and `/edit`) — you'll need this shortly.

## Step 2 — Turn on the Places API (New) in Google Cloud

1. Go to console.cloud.google.com and make sure you're in the **same project** you used for the content calendar.
2. In the search bar at the top, type "Places API (New)" and click it.
3. Click **Enable**.

## Step 3 — Create a Places API key

This is a different, simpler kind of key than your service account — just a single string of letters/numbers.

1. In Google Cloud Console, go to **APIs & Services → Credentials**.
2. Click **+ Create Credentials → API key**.
3. A key appears — copy it somewhere safe.
4. (Recommended, not required) Click on the new key, and under "API restrictions," restrict it to only "Places API (New)" — this just limits what the key can be used for if it ever leaked.

## Step 4 — Set up the project on GitHub

Same pattern as your content calendar:

1. Create a **new** GitHub repository (e.g. `client-lead-system`) — keep it Private.
2. Upload everything from this folder **except** `.env` and `service-account-key.json` (there are none in this folder yet — you'll add secrets instead, see Step 5).
3. Double check the `.github` folder made it in — if not, use the same manual "Add file → Create new file" trick you used before to recreate `.github/workflows/weekly-leads.yml`.

## Step 5 — Add your secrets

In your new repo: **Settings → Secrets and variables → Actions → New repository secret**. Add these 4:

| Secret name | Value |
|---|---|
| `LEADS_SHEET_ID` | The Sheet ID from Step 1 |
| `GEMINI_API_KEY` | Your existing Gemini key (same one as before) |
| `GOOGLE_PLACES_API_KEY` | The key you created in Step 3 |
| `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` | The full contents of your `service-account-key.json` file (same value you used for the content calendar) |

## Step 6 — Run it for the first time

1. Go to the **Actions** tab in your new repo.
2. Click "Weekly Lead Search" on the left.
3. Click **Run workflow** (you can leave "limit" as 20, or type a different number).
4. Wait about a minute, then check your Leads Sheet — you should see new rows.

## Step 7 — You're done

From now on, it runs itself every Monday at 7am UTC, adding fresh leads and
skipping any business it's already found before (tracked in the hidden "Used
Leads" tab — don't edit that one).

---

## How to actually use the leads

- **Email leads**: copy the email into your own email client and send your pitch manually (Stage 2 will add AI-drafted email pitches too, once you're ready).
- **WhatsApp leads**: click the link in the "WhatsApp Link" column — it opens WhatsApp (web or app) with the message already typed into the chat box. Read it over, tweak if you like, hit Send.
- Fill in the **Status** column yourself as you work through leads — this sheet doesn't auto-track replies.

## Adjusting things later

- **More/fewer leads per run**: change the `limit` when running the workflow manually, or edit the default in `.github/workflows/weekly-leads.yml`.
- **Different categories or search terms**: edit `config/categories.js`.
- **Different schedule**: change the `cron` value in the workflow file (currently every Monday 7am UTC).
