# Family Budget PWA

A progressive web app for tracking multi-currency family expenses with real-time exchange rates, advanced filtering, and beautiful reports.

**Features:**
- ✅ Multi-currency support (UAH, PLN, EUR, USD) with live NBU exchange rates
- ✅ Add, edit, and soft-delete transactions
- ✅ Flexible tagging system with cascading dropdowns
- ✅ Advanced filtering by date, author, and tags
- ✅ Transaction history with pagination
- ✅ Beautiful charts and reports (category, timeline, author, companies)
- ✅ Offline-first PWA (works without internet)
- ✅ Zero-cost infrastructure (Google Sheets + Apps Script + GitHub Pages)
- ✅ Multi-user support with email whitelist

---

## Tech Stack

- **Frontend:** Vanilla JavaScript (ES modules), Tailwind CSS, Chart.js
- **Backend:** Google Apps Script (GAS)
- **Database:** Google Sheets
- **Auth:** Google OAuth (native GAS Session)
- **Exchange Rates:** NBU API (free, no key required)
- **Hosting:** GitHub Pages
- **PWA:** Service Worker + Web Manifest

---

## Prerequisites

1. **Google Account** — to create Google Sheets and Apps Script
2. **GitHub Account** — to host the frontend on GitHub Pages
3. **Basic Terminal Knowledge** — to clone the repo and push to GitHub

---

## Setup Guide

### Step 1: Create Google Sheet & Apps Script Project

1. Go to [Google Sheets](https://sheets.google.com) and create a new sheet
2. Rename it to `Family Budget`
3. Create three sheets inside it:
   - `transactions`
   - `tag_definitions`
   - `settings`

### Step 2: Set Up Sheets Structure

#### Sheet: `transactions`
Add these column headers in row 1:
```
id | date | amount_uah | amount_pln | amount_eur | amount_usd | base_currency | author | tags | deleted
```

#### Sheet: `tag_definitions`
Add these column headers in row 1:
```
key | value | related_to
```

Example rows:
```
category | food |
category | transport |
company | biedronka | category:food
company | metro |
target | Serhii |
target | Anna |
target | All |
payment_method | cash |
payment_method | card |
```

#### Sheet: `settings`
Add these column headers in row 1:
```
key | value
```

Example rows:
```
family_name | Our Family Budget
allowed_emails | your-email@gmail.com,spouse-email@gmail.com
email_map | your-email@gmail.com:Your Name,spouse-email@gmail.com:Spouse Name
member_names | Your Name,Spouse Name,Child Name,All
```

⚠️ **Important:** Update `allowed_emails`, `email_map`, and `member_names` with your actual data.

### Step 3: Deploy Google Apps Script Backend

1. Open your Google Sheet
2. Click **Extensions → Apps Script**
3. Copy all code from `Code.gs` in this repo into the editor
4. Click **Save** (Project name: "Family Budget")
5. Click **Deploy → New Deployment**
6. Select **Type: Web App**
   - **Execute as:** You (your Google account)
   - **Who has access:** Anyone with a Google Account
7. Click **Deploy**
8. Copy the deployment URL (looks like `https://script.google.com/macros/d/{SCRIPT_ID}/userweb`)

### Step 4: Configure Frontend

1. Open `app/api.js` in this repo
2. Find the line: `const GAS_URL = 'https://script.google.com/macros/d/YOUR_SCRIPT_ID/userweb';`
3. Replace `YOUR_SCRIPT_ID` with your actual Script ID (from Step 3)
4. Save the file

### Step 5: Deploy to GitHub Pages

1. Fork this repo or create a new repo with the same structure
2. Push all files to your repo
3. Go to **Settings → Pages**
4. Set **Source:** Deploy from a branch
5. Set **Branch:** main, root folder
6. Click **Save**
7. Your app is now live at `https://your-username.github.io/family-budget/`

⚠️ **Note:** If you want a custom domain, configure it in GitHub Pages settings.

---

## Usage

### First Login
1. Open your deployed URL
2. You'll be redirected to Google to authorize the app
3. The app checks your email against `allowed_emails` in the settings sheet

### Add Transaction
1. Click **➕ Add** tab
2. Fill in the date, amount, and currency
3. The other 3 currency fields auto-calculate
4. Add tags (category, company, target, payment method)
5. Click **Save Transaction**

### View History
1. Click **📋 History** tab
2. Filter by date range, author, or tags
3. Click **Edit** or **Delete** on any row
4. Deleted transactions appear in the "Deleted" section and can be restored

### View Reports
1. Click **📊 Reports** tab
2. Use the same filters as History
3. Choose currency for all charts
4. View:
   - **Cards:** Total spent, Top category, Top spender
   - **Charts:** Category breakdown, Timeline (daily/weekly), Author pie chart, Top 10 companies

---

## Architecture

### Frontend Modules

- **`app/api.js`** — GAS API wrapper with caching (sessionStorage)
- **`app/currency.js`** — NBU exchange rate fetcher (localStorage cache, 4h TTL)
- **`app/tags.js`** — Tag parsing and cascading dropdowns
- **`app/add.js`** — Add transaction form
- **`app/history.js`** — Transaction table with filters, edit, delete
- **`app/charts.js`** — Reports with 4 Chart.js visualizations

### Backend (Google Apps Script)

- **`Code.gs`** — Single file with all endpoints:
  - GET `/transactions` (with filters)
  - GET `/tag_definitions`
  - GET `/settings` (safe subset)
  - POST `/add`, `/edit`, `/soft_delete`, `/restore`
  - All endpoints require email auth check

### Data Flow

```
User Input (Form)
    ↓
app/add.js (with currency conversion)
    ↓
app/api.js (fetch to GAS)
    ↓
Code.gs (validates email, writes to Sheets)
    ↓
Google Sheets (stored + soft-deleted, never purged)
```

### Caching Strategy

| What | Where | TTL | Strategy |
|------|-------|-----|----------|
| Transactions | API response | None | Always fresh (date-filtered) |
| Tag definitions | sessionStorage | Session | Cleared on reload/tab switch |
| Settings | sessionStorage | Session | Cleared on reload/tab switch |
| Exchange rates | localStorage | 4 hours | Auto-expires |
| App shell | Service Worker | Indefinite | Cache-first |
| API calls | Service Worker | — | Network-only (never cache) |

---

## Customization

### Change App Title
In `app/settings` sheet, update the `family_name` value. It loads on app startup.

### Add New Tag Keys
1. Add rows to `tag_definitions` sheet with your new key
2. The app will auto-detect them in the cascading dropdowns

### Change Theme Color
1. Update `#6366f1` in `manifest.json` (theme_color)
2. Update `#6366f1` in `index.html` (Tailwind classes)
3. Redeploy frontend

### Generate Icons
1. Use a tool like [favicon.io](https://favicon.io) to create 192x192 and 512x512 PNG icons
2. Replace `icon-192.png` and `icon-512.png` in the repo
3. Redeploy

---

## Troubleshooting

### "Forbidden" error on first load
- Check `allowed_emails` in the settings sheet
- Your email must match exactly (case-insensitive comparison happens server-side)
- Try signing out of Google and signing in again

### Exchange rates not showing
- NBU API might be down (it's free, so no uptime SLA)
- Check browser console for errors
- Fallback: rates are cached for 4 hours, so last known rates still work

### Service Worker not caching
- Clear browser cache and reload
- Check DevTools → Application → Service Workers
- Try incognito mode (no extensions interfering)

### Changes not showing after deploy
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Clear Service Worker cache in DevTools
- Wait a few minutes (GitHub Pages CDN caching)

---

## Security Notes

- **Email whitelist** enforced server-side (GAS checks `Session.getActiveUser()`)
- **No secrets in frontend** — GAS URL is not a secret (it's authenticated)
- **Safe HTML rendering** — no `innerHTML` with user data (prevents XSS)
- **Soft deletes only** — transactions never physically removed (audit trail)
- **OAuth via Google** — no password storage, no credential management

---

## Offline Mode

The app works offline thanks to the Service Worker:

- ✅ View cached transactions and reports
- ✅ Cached exchange rates (4 hours)
- ❌ Cannot add new transactions (requires GAS authentication)
- ❌ Cannot sync changes with backend

When you regain connection, sync happens automatically on next action.

---

## Cost Analysis

| Component | Cost |
|-----------|------|
| Google Sheets | Free (15 GB) |
| Google Apps Script | Free (1 million executions/month) |
| GitHub Pages | Free |
| NBU Exchange API | Free (no key required) |
| **Total** | **$0/month** |

---

## Support & Contribution

This is a self-hosted PWA. For issues:

1. Check the **Troubleshooting** section above
2. Verify your Google Sheets structure matches the setup guide
3. Check browser DevTools console for errors
4. Ensure your GAS deployment URL is correctly set in `app/api.js`

---

## License

MIT — Feel free to fork, modify, and deploy for personal use.

---

**Happy budgeting!** 💰
