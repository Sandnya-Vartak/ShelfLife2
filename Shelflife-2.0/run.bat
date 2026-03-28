@echo off
REM StartUp script for ShelfLife on Windows

echo.
echo 🚀 Starting ShelfLife Pantry Manager...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python not found. Please install Python 3.8+
    pause
    exit /b 1
)

REM Check if .env exists
if not exist .env (
    echo ⚠️  .env file not found. Creating default .env...
    (
        echo SECRET_KEY=dev_secret_key
        echo JWT_SECRET_KEY=jwt_dev_secret
        echo DATABASE_URL=sqlite:///pantry.db
        echo MAIL_SERVER=smtp.gmail.com
        echo MAIL_PORT=587
        echo MAIL_USE_TLS=True
        echo MAIL_USERNAME=your_email@gmail.com
        echo MAIL_PASSWORD=your_app_password
        echo MAIL_DEFAULT_SENDER=noreply@pantry.com
    ) > .env
    echo ✅ .env created. Please update email credentials.
)

REM Install/Check dependencies
echo 📦 Checking dependencies...
pip install -q -r requirements.txt

REM Initialize database if needed
if not exist "instance\pantry.db" (
    echo 📊 Initializing database...
    python -c "from app import app, db; app_ctx = app.app_context(); app_ctx.push(); db.create_all(); print('Database initialized'); app_ctx.pop()"
)

REM Start Flask server
echo ✨ Starting Flask server...
echo 🌐 Access the app at: http://localhost:5000
echo.
python app.py

pause
