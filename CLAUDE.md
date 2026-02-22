# Family Budget PWA — AI Developer Requirements

## Role
You are a senior full-stack developer. The Architect provides tasks. You implement, test mentally, and deliver complete, working code. No placeholders. No TODOs. Ask before assuming.

## Stack
- **Frontend**: Vanilla JS (ES modules), Tailwind CSS (CDN), Chart.js (CDN), PWA
- **Backend**: Google Apps Script (GAS) — one `Code.gs` file, deployed as Web App
- **Database**: Google Sheets (structure defined below)
- **Auth**: Google OAuth via GAS native (`Session.getActiveUser()`)
- **Exchange rates**: NBU API (no key required), client-side, cached 4h in `localStorage`
- **Hosting**: GitHub Pages (static files only — no Node, no build step)

## Constraints
- Zero cost infrastructure — no paid APIs, no servers
- No npm, no bundler, no framework. CDN only.
- All secrets stay in GAS (none in frontend)
- OWASP basics: no `innerHTML` with user data, whitelist auth on every GAS endpoint
- Offline: PWA service worker caches app shell only (not data)

---

## Google Sheets Structure

### Sheet: `transactions`
| Column | Type | Notes |
|--------|------|-------|
| id | string | UUID v4, generated client-side |
| date | string | ISO 8601 `YYYY-MM-DD` |
| amount_uah | number | Always stored |
| amount_pln | number | Always stored |
| amount_eur | number | Always stored |
| amount_usd | number | Always stored |
| base_currency | string | UAH / PLN / EUR / USD — user's input currency |
| author | string | Display name (from `settings`) |
| tags | string | `key:value;key:value` e.g. `category:food;company:biedronka;target:all` |
| deleted | boolean | FALSE by default. TRUE = soft-deleted. Never physically removed. |

### Sheet: `tag_definitions`
| Column | Type | Notes |
|--------|------|-------|
| key | string | `category`, `company`, `target`, `payment_method` |
| value | string | e.g. `food`, `biedronka`, `Serhii` |
| related_to | string | Optional. `category:food` means show this value only when that tag is active |

### Sheet: `settings`
| Column | Type | Notes |
|--------|------|-------|
| key | string | See keys below |
| value | string | See values below |

| key | value format | example |
|-----|-------------|---------|
| `family_name` | plain string | `Our Family Budget` |
| `allowed_emails` | comma-separated emails | `serhii@gmail.com,wife@gmail.com` |
| `email_map` | `email:DisplayName` comma-separated | `serhii@gmail.com:Serhii,wife@gmail.com:Anna` |
| `member_names` | comma-separated display names (targets) | `Serhii,Anna,Mia,All` |

**Rules:**
- `email_map` drives author resolution — GAS resolves caller email → display name server-side
- `member_names` drives the `target` tag dropdown in the UI
- `target` values are NOT stored in `tag_definitions` — sourced from `member_names` only
- Frontend never receives the full `email_map` — only the resolved name for the current user

---

## GAS Endpoints (`Code.gs`)

All requests: check `Session.getActiveUser().getEmail()` against `allowed_emails`. Return `{error: "Forbidden", code: 403}` if not allowed.

### GET endpoints (`?action=...`)

| action | params | returns |
|--------|--------|---------|
| `transactions` | `from` (date), `to` (date), `author` (optional), `tag` (optional `key:value`) | Array of non-deleted transaction objects |
| `tag_definitions` | — | Array of `{key, value, related_to}` |
| `settings` | — | `{family_name, current_user_name, member_names[]}` — resolves caller email via `email_map` server-side; never returns full email_map to client |

### POST endpoints (JSON body, `?action=...`)

| action | body | behavior |
|--------|------|----------|
| `add` | transaction object (without `deleted`) | Appends row, sets `deleted=FALSE` |
| `soft_delete` | `{id}` | Finds row by id, sets `deleted=TRUE` |
| `restore` | `{id}` | Finds row by id, sets `deleted=FALSE` |
| `edit` | full transaction object with `id` | Finds row by id, updates all fields |

**Response format** (always):
```json
{ "success": true, "data": ... }
{ "success": false, "error": "message" }
```

---

## Frontend Modules

### `app/api.js`
- `fetchTransactions(filters)` — GET transactions with optional filters
- `fetchTagDefinitions()` — GET tag_definitions, cache in `sessionStorage`
- `fetchSettings()` — GET settings, cache in `sessionStorage`
- `addTransaction(obj)` — POST add
- `softDelete(id)` — POST soft_delete
- `restoreTransaction(id)` — POST restore
- `editTransaction(obj)` — POST edit
- All functions: handle GAS errors, throw with message

### `app/currency.js`
- `getRates()` — fetch from NBU API, cache in `localStorage` with 4h TTL. Returns `{PLN, EUR, USD}` as rates to UAH.
- NBU endpoint: `https://bank.gov.ua/NBU_Exchange/exchange_new?json`
- Filter to: USD, EUR, PLN only
- `convertAll(amount, fromCurrency, rates)` — returns `{uah, pln, eur, usd}` all rounded to 2 decimal places
- `recalcFrom(changedCurrency, changedValue, currentAmounts, rates)` — user edited one field manually; recalculate other 3

### `app/tags.js`
- `loadTagDefinitions()` — calls api.js, returns structured map
- `getCascadedValues(key, activeTag)` — returns valid values for `key` given active tag context
- `parseTags(tagString)` — `"category:food;company:biedronka"` → `{category: "food", company: "biedronka"}`
- `serializeTags(obj)` — reverse of above
- Predefined keys (hardcoded fallback): `category`, `company`, `target`, `payment_method`

### `app/add.js`
- Renders Add Transaction form
- On load: fetch settings → auto-fill Author field with `current_user_name` (read-only, not editable)
- Target dropdown populated from `member_names` (fetched from settings)
- Fields: date (default today), amount input + currency selector, 4 currency display fields (all editable), author (read-only), tag selectors (cascading)
- On any currency field edit → call `currency.recalcFrom()` → update other 3
- On submit → validate → call `api.addTransaction()` → show success toast → reset form

### `app/history.js`
- Renders History tab
- Filter bar: date range, author multi-select, tag filter (key + value dropdowns)
- Table columns: date, author, tags (badges), UAH, PLN, EUR, USD, actions (edit / delete)
- Soft-deleted rows: show in separate "Deleted" collapsible section with Restore button
- Pagination: 20 rows per page, client-side
- Edit: opens inline edit row or modal (reuse add form logic)

### `app/charts.js`
- All charts use Chart.js. All operate on in-memory filtered dataset.
- Filter bar (shared with history): date range, author, tag key:value, display currency
- **Card row**: Total (selected period), Top category, Top spender
- **Chart 1 — Bar**: Spending by category. X=category, Y=amount in selected currency.
- **Chart 2 — Line**: Spending over time. X=date, Y=cumulative daily total. Toggle: daily/weekly.
- **Chart 3 — Pie**: Spending by author.
- **Chart 4 — Bar**: Top 10 companies by spend.
- All charts: responsive, destroy+recreate on filter change.

### `index.html`
- Tailwind CDN in `<head>`
- Chart.js CDN in `<head>`
- Tab navigation: ➕ Add | 📋 History | 📊 Reports
- Import all app/*.js as ES modules
- `<link rel="manifest" href="manifest.json">`
- Register `sw.js` on load

### `manifest.json`
```json
{
  "name": "Family Budget",
  "short_name": "Budget",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#6366f1",
  "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"}]
}
```

### `sw.js`
- Cache-first for app shell: `index.html`, all `app/*.js`, `manifest.json`, icons
- Network-only for all `script.google.com` requests (never cache API calls)

---

## Coding Standards
- ES modules (`import/export`), no CommonJS
- `async/await` everywhere, try/catch with user-facing error messages
- No `innerHTML` with user-controlled data — use `textContent` or DOM methods
- Functions: single responsibility, max ~30 lines
- Constants at top of each file
- GAS: no `var`, use `const`/`let`, return JSON with `ContentService.createTextOutput(...).setMimeType(...)`

---

## Repository Structure

```
family-budget/
├── app/
│   ├── api.js
│   ├── currency.js
│   ├── tags.js
│   ├── add.js
│   ├── history.js
│   └── charts.js
├── styles/
│   └── app.css
├── icon-192.png
├── icon-512.png
├── index.html
├── manifest.json
├── sw.js
├── .gitignore
└── README.md
```

`Code.gs` lives only in Google Apps Script editor. Never commit it to the repo.

## `.gitignore`

Generate this exact `.gitignore` in the repo root:

```gitignore
# Secrets / config
.env
.env.*
*.env
config.local.js
secrets.js

# OS
.DS_Store
Thumbs.db
desktop.ini

# IDE
.vscode/
.idea/
*.suo
*.user

# Logs
*.log
npm-debug.log*

# Dependencies (not used, safe default)
node_modules/

# Build artifacts (not used, safe default)
dist/
build/
```

**OWASP note:** `GAS_URL` in `api.js` is not a secret (authenticated endpoint), but treat it as configuration. Never log request payloads or user data to `console.log` in production code. No sensitive data in URL parameters.

---

## Delivery Order (task sequence for AI developer)

1. `Code.gs` — full GAS backend with all endpoints
2. `app/api.js` — frontend API wrapper
3. `app/currency.js` — NBU fetch + conversion logic
4. `app/tags.js` — tag parsing + cascading
5. `app/add.js` — add transaction form
6. `app/history.js` — history table + filters + soft-delete UI
7. `app/charts.js` — all 4 charts + filter bar + cards
8. `index.html` — shell, tabs, CDN links, module imports
9. `manifest.json` + `sw.js` — PWA setup
10. `README.md` — deployment steps

Each task: deliver complete file. State assumptions made. Flag any blocker before writing.