# ShelfLife 2.0

ShelfLife is a small Flask + vanilla JS project that helps people keep food from going bad. It layers a basic login system on top of a pantry dashboard and alert center so the app feels like a student project that grew with new ideas over time.

## What it does
- Track pantry items with expiry dates, quantity, and price information.
- Show how much has been consumed, wasted, or prevented across alerts.
- Consolidate notifications, research tips, and utilization metrics on dedicated pages.
- Let each user register, authenticate, and manage their own item list.

## How it works
1. The Flask server holds the database models and controllers (formerly called routes).
2. Each controller only talks to a focused module in the `core/` package, which contains the business logic like sending notification emails and computing metrics.
3. The frontend keeps HTML, CSS, and JS separate; every page loads a small script that talks to the API and renders the response with lightweight helpers.
4. JWT tokens are stored in local storage/cookies so the UI can stay signed in across browser refreshes.

## Getting started
1. Copy `.env.example` to `.env` and fill in the database/SMTP values you intend to use.
2. Create a virtual environment (`python -m venv .venv`) and install requirements (`pip install -r requirements.txt`).
3. Run `flask db init`/`flask db migrate`/`flask db upgrade` if you wire up migrations, or simply let `app.py` create tables automatically.
4. Start the app with `python app.py` or `flask run` and open `http://localhost:5000` in your browser.
5. Use the Register form to create an account, then explore the dashboard, consumption, and utility pages.

Everything is intentionally handheld and close to the metal so it can be extended without a framework-heavy rewrite.
