# Client Lead Finder — Setup Guide

This system automatically finds potential clients (gyms, boutiques, restaurants,
salons across Nigeria) every week, and preps outreach for each one:

- **Business has a website with a findable email** → it drafts a short email pitch (subject + body) and gives you a one-click link that opens your email app with everything pre-filled
- **Business has a website but no findable email** → it drafts a WhatsApp message instead, using their phone number
- **Business has no website at all** → same WhatsApp treatment, worded for that situation

In every case, you still review and click Send yourself — nothing goes out automatically.

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

- **Email leads**: click the link in the "Email Link" column — it opens your email app with the subject and body already filled in. Read it over, tweak if you like, hit Send.
- **WhatsApp leads**: click the link in the "WhatsApp Link" column — it opens WhatsApp (web or app) with the message already typed into the chat box. Read it over, tweak if you like, hit Send.
- Fill in the **Status** column yourself as you work through leads — this sheet doesn't auto-track replies.

## Adjusting things later

- **More/fewer leads per run**: change the `limit` when running the workflow manually, or edit the default in `.github/workflows/weekly-leads.yml`.
- **Different categories or search terms**: edit `config/categories.js`.
- **Different schedule**: change the `cron` value in the workflow file (currently every Monday 7am UTC).

---

## Stage 3 — Automatically Sending Approved Emails (free, via your own Gmail)

This part runs separately from everything above — not on GitHub, but directly
inside your Leads Google Sheet, using a free Google feature called Apps
Script. It sends emails through your own Gmail account (no paid tool needed)
and automatically marks leads as "Replied" when someone responds.

**How it works day-to-day:** each week, new leads show up with drafted
emails. When you review one and like it, type **YES** in the "Approved to
Send?" column. The automation checks daily and sends anything marked YES —
up to 5 per day, so it doesn't blast everything at once. Nothing sends
without you typing YES first.

### Setup (one-time, about 10 minutes)

1. Open your Leads Google Sheet.
2. Click **Extensions → Apps Script** in the menu.
3. Delete any placeholder code already in the editor (usually `function myFunction() {}`).
4. Open `apps-script/EmailAutomation.gs` from this project folder, copy its entire contents, and paste it into the Apps Script editor.
5. Click the **Save** icon (or Ctrl+S). Name the project something like "Lead Email Automation".
6. In the toolbar, make sure the function dropdown shows `dailyEmailAutomation`, then click **Run**.
7. The first time, Google will ask for permission (since the script needs to read your Sheet and send Gmail on your behalf). Click **Review permissions** → choose your account → you'll likely see an "unverified app" warning since this is your own personal script, not a published app — click **Advanced** → **Go to (your project name) (unsafe)** → **Allow**. This is expected and safe; it's just Google's standard warning for any personal script.
8. Once it runs successfully, click the **clock icon** ("Triggers") in the left sidebar.
9. Click **+ Add Trigger**. Set:
   - Function: `dailyEmailAutomation`
   - Event source: `Time-driven`
   - Type: `Day timer`
   - Time: pick any hour that suits you (e.g. 9am–10am)
10. Click **Save**. Done — this now runs automatically every day, forever, with zero further action from you.

### Using it

- Review new leads each week in the "Email Body (draft)" column.
- Type **YES** in "Approved to Send?" for any you're happy with.
- The next daily run will send it (up to 5/day) and fill in "Email Sent Date" and a hidden "Gmail Thread ID" automatically.
- When a lead replies, the next daily run detects it and sets Status to **Replied** automatically — you'll also see it land in your own Gmail inbox as normal.
- Once you trust the drafts fully and want to skip manual approval, you can adjust the script's logic (or just always type YES) — full auto-send was intentionally not the default, to keep a human check in the loop while you build trust in the AI's writing.

### Adjusting

- **Send more/fewer per day**: change `DAILY_SEND_LIMIT` near the top of the script (in the Apps Script editor, not this local file — edit it there directly).
- **Change the run time**: edit the trigger under the clock icon.
