# ShelfLife 2.0

ShelfLife started as a classroom idea: a web app that lets someone see what lives in their pantry, know which ingredients are about to go past their prime, and make better decisions about what to cook next. It still uses Flask on the backend and modest vanilla JavaScript in the browser, so it feels like the kind of project that grows organically as you swap in new pages and helpers.

## Why it exists
- Most food-tracking toys focus on slick marketing copy. ShelfLife keeps the focus on plain, practical signals: what did I buy, how long will it keep, and when should I use it?
- Each user has their own pantry ledger, alert feed, and utilization snapshots so the app is personal instead of generic.
- Notifications tie into real emails (when configured) so the user has a gentle reminder outside the UI as well.

## How the system flows
1. The frontend loads a simple HTML shell and attaches the matching JavaScript module (dashboard, pantry, notifications, etc.).
2. Each page script calls the shared API helper (`js/apiClient.js`) to fetch data, then passes it to lightweight render helpers without recreating fetch logic everywhere.
3. Flask exposes a few blueprints (`controllers/`) that merely orchestrate what the `core/` modules do: validate inputs, query models, send notification emails, and calculate metrics.
4. JWT tokens and cookies keep the session alive, so users stay logged in while the JS renders their name and avatars on every page.
5. Background scheduler jobs re-run the expiry calculations every day so the alert feed never gets stale.

## Notable features
- **Pantry ledger** – Add/edit/delete items with quantity, currency-aware pricing, and either a calendar date or an “expiry days” shortcut.  
- **Dashboard alerts** – The overview page highlights urgent items, shows quick stats, and links to the areas you use the most.  
- **Notifications** – Mark alerts read, consume directly from that list, and clear the backlog of expired warnings.  
- **Utilization & consumption** – Parallel dashboards summarize money spent/saved, what was consumed, and what slipped past its expiry.  
- **Research guide** – A companion page that captures practical tips so you can tune storage, prep, and cooking rhythms.

## Setup steps
1. Copy `.env.example` to `.env` and fill the values for the database, mail server (if you plan to send emails), and any other environment variables.  
2. Create and activate a Python virtual environment (`python -m venv .venv` + `.\.venv\Scripts\Activate.ps1` on Windows).  
3. Install dependencies with `pip install -r requirements.txt`.  
4. Run `python app.py` (or `flask run`) and visit `http://localhost:5000`. The app will create the database tables automatically if they don’t exist yet.  
5. Register a test user, fill the pantry, and explore the dashboard, notification center, and analytics pages.

The stack is deliberately low-friction: simple blueprints, shareable frontend helpers, and no extra frameworks so you can experiment with new features without rewriting the whole layout.
