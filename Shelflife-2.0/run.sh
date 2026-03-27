#!/bin/bash
# StartUp script for ShelfLife

echo "🚀 Starting ShelfLife Pantry Manager..."
echo ""

# Check if Python is installed
if ! command -v python &> /dev/null; then
    echo "❌ Python not found. Please install Python 3.8+"
    exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating default .env..."
    cat > .env << 'EOF'
SECRET_KEY=dev_secret_key
JWT_SECRET_KEY=jwt_dev_secret
DATABASE_URL=sqlite:///pantry.db
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
MAIL_DEFAULT_SENDER=noreply@pantry.com
EOF
    echo "✅ .env created. Please update email credentials."
fi

# Install/Check dependencies
echo "📦 Checking dependencies..."
pip install -q -r requirements.txt

# Initialize database if needed
if [ ! -f instance/pantry.db ]; then
    echo "📊 Initializing database..."
    python << 'PYEOF'
from app import app, db
with app.app_context():
    db.create_all()
    print("✅ Database created successfully")
PYEOF
fi

# Start Flask server
echo "✨ Starting Flask server..."
echo "🌐 Access the app at: http://localhost:5000"
echo ""
python app.py
