# ShelfLife - Quick Start Guide

## 🚀 Fast Onboarding

### Step 1: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 2: Create Environment File
Create a `.env` file in the root directory:
```
SECRET_KEY=your_secret_key
JWT_SECRET_KEY=your_jwt_secret
DATABASE_URL=sqlite:///pantry.db
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
MAIL_DEFAULT_SENDER=noreply@pantry.com
MAIL_SENDER_NAME=Shelf Life
ADMIN_SECRET=a_long_random_string
``` 

### Step 3: Initialize Database
```bash
python
>>> from app import app, db
>>> with app.app_context():
...     db.create_all()
>>> exit()
```

### Step 4: Run the Flask Server
```bash
python app.py
```

The app will start at: **http://localhost:5000**

## 🔧 Troubleshooting NetworkError

If you're getting a NetworkError:

1. **Check Flask is running** - You should see "Running on http://127.0.0.1:5000"
2. **Check browser console** - Open DevTools (F12) → Console to see network requests
3. **Verify CORS** - The Flask app has CORS configured for API routes
4. **Check API endpoints**:
   - Login: `POST /auth/login`
   - Register: `POST /auth/register`
   - Get items: `GET /inventory/items`
   - Add item: `POST /inventory/add-item`

## 📂 Project Structure
- `/frontend/` - HTML pages
- `/js/` - JavaScript API client logic
- `/routes/` - Flask API endpoints
- `/models/` - Database models
- `/services/` - Email & expiry services

## 🎯 Default Workflow
1. Navigate to `http://localhost:5000`
2. Landing page opens at `/`
3. Register a new account
4. Access dashboard to manage pantry items
