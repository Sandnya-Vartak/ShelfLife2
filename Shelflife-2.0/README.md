# ShelfLife 2.0

A personal pantry management application built with Flask and vanilla JavaScript. Users can track food items, receive expiry alerts, monitor spending, and reduce food waste through a clean dashboard interface.

## Purpose

Keeping track of what is in your pantry and when items expire is surprisingly difficult. ShelfLife solves this by giving each user a private inventory with expiry-based alerts, email notifications, and consumption tracking — all in one lightweight app.

## Architecture Overview

The project is divided into four main layers:

- **Frontend** — Plain HTML pages, each backed by a dedicated JavaScript module under `js/`. All API communication is handled through the shared `js/apiClient.js` helper so individual page scripts stay focused on rendering.
- **Controllers** — Flask blueprints under `controllers/` that handle routing, request validation, and response formatting.
- **Core services** — Business logic lives in `core/`: expiry calculations, email dispatch, and utilization metrics.
- **Models & Database** — SQLAlchemy models for users, items, and notifications, with support for both SQLite (local) and MySQL (production).

## Key Features

- **Inventory management** — Add, edit, and delete pantry items with name, category, quantity, expiry date, price, and currency.
- **Expiry status tracking** — Items are automatically classified as fresh, expiring soon, expiring critically, or expired based on days remaining.
- **Alert feed** — Per-user notification list that refreshes on every visit and cleans up stale entries automatically.
- **Email alerts** — Supports both SMTP and SendGrid. Urgent pre-expiry items can trigger email reminders once per day until they are consumed or expire.
- **Utilization dashboard** — Shows total money spent, saved (consumed before expiry), and wasted (items that expired unused).
- **Consumption summary** — Tracks which items were consumed vs. which expired without being used.
- **Research guide** — Built-in reference page with food storage tips and practical shelf-life guidance.
- **Password reset** — Token-based reset flow with time-limited JWT links delivered to the user's email.

## Getting Started

### Prerequisites

- Python 3.10 or later
- pip

### Installation

```bash
# 1. Clone the repository
git clone <repo-url>
cd Shelflife-2.0

# 2. Create and activate a virtual environment
python -m venv .venv
# Windows:  .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set up environment variables
cp .env.example .env
# Open .env and fill in your database and mail settings

# 5. Run the app
python app.py
```

Open `http://localhost:5000` in your browser. Database tables are created automatically on the first run.

### Environment Variables

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Flask session secret |
| `JWT_SECRET_KEY` | JWT signing key |
| `DATABASE_URL` | Full DB connection string (overrides individual vars) |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection details |
| `MAIL_USERNAME`, `MAIL_PASSWORD` | SMTP credentials |
| `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` | SendGrid credentials |
| `MAIL_TEST_MODE` | Set `True` to skip real email sending during development |
| `FRONTEND_URL` | Base URL used in password reset links |
| `ADMIN_SECRET` | Secret header value for the admin bulk-email endpoint |

## Project Structure

```
Shelflife-2.0/
├── app.py                  # Entry point, blueprint registration, scheduler setup
├── config.py               # Environment-driven configuration class
├── controllers/            # Flask blueprints: auth, inventory, notifications
├── core/                   # Business logic: expiry service, email, metrics
├── models/                 # SQLAlchemy models: User, Item, Notification
├── database/               # DB instance and column migration helper
├── helpers/                # JWT token generation utility
├── scheduler/              # Daily background job for expiry checks
├── frontend/               # HTML page templates
├── js/                     # Per-page JS modules + shared ApiClient
├── css/                    # Page stylesheets
└── assets/                 # SVG icons used in the UI
```

## Debug Utilities

- `check_user_data.py` — Print items and notifications for a given user. Set `TARGET_EMAIL` before running.
- `send_email_manual.py` — Manually dispatch expiry emails for a given user. Set `TARGET_EMAIL` before running.
