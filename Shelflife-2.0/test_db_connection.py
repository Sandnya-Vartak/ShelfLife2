#!/usr/bin/env python
"""
Database Connection Test Script
Tests Flask app database connectivity
"""

import sys
import os

print("\n" + "="*60)
print("ShelfLife Database Connection Diagnostic")
print("="*60)

# Test 1: Check environment variables
print("\n[1] Checking environment variables...")
from dotenv import load_dotenv
load_dotenv()

db_host = os.getenv("DB_HOST")
db_user = os.getenv("DB_USER")
db_password = os.getenv("DB_PASSWORD")
db_name = os.getenv("DB_NAME")

print(f"   DB_HOST: {db_host}")
print(f"   DB_USER: {db_user}")
print(f"   DB_NAME: {db_name}")
print(f"   DB_PASSWORD: {'*' * len(db_password) if db_password else 'NOT SET'}")

# Test 2: Check PyMySQL installation
print("\n[2] Checking PyMySQL...")
try:
    import pymysql
    print(f"   ✅ PyMySQL installed (version: {pymysql.__version__})")
except ImportError:
    print("   ❌ PyMySQL NOT installed!")
    sys.exit(1)

# Test 3: Test MySQL connection
print("\n[3] Testing MySQL connection...")
try:
    conn = pymysql.connect(
        host=db_host,
        user=db_user,
        password=db_password,
        database=db_name
    )
    print(f"   ✅ Connected to MySQL successfully!")
    
    cursor = conn.cursor()
    
    # Get MySQL version
    cursor.execute("SELECT VERSION()")
    version = cursor.fetchone()
    print(f"   MySQL Version: {version[0]}")
    
    # List tables
    cursor.execute("SHOW TABLES")
    tables = cursor.fetchall()
    print(f"\n   Tables in database '{db_name}':")
    if tables:
        for table in tables:
            print(f"     - {table[0]}")
    else:
        print("     ❌ NO TABLES FOUND!")
    
    # Count records
    try:
        cursor.execute("SELECT COUNT(*) FROM user")
        user_count = cursor.fetchone()[0]
        print(f"\n   Records:")
        print(f"     - user table: {user_count} records")
        
        cursor.execute("SELECT COUNT(*) FROM item")
        item_count = cursor.fetchone()[0]
        print(f"     - item table: {item_count} records")
        
        cursor.execute("SELECT COUNT(*) FROM notification")
        notif_count = cursor.fetchone()[0]
        print(f"     - notification table: {notif_count} records")
    except Exception as e:
        print(f"   ❌ Error counting records: {e}")
    
    cursor.close()
    conn.close()
    
except pymysql.err.OperationalError as e:
    print(f"   ❌ Connection Failed: {e}")
    print("\n   Possible solutions:")
    print("   1. Start MySQL service")
    print("   2. Check host, user, password credentials")
    print("   3. Ensure database 'shelflife' exists")
    sys.exit(1)
except Exception as e:
    print(f"   ❌ Error: {type(e).__name__}: {e}")
    sys.exit(1)

# Test 4: Test Flask app
print("\n[4] Testing Flask app configuration...")
try:
    from config import Config
    from app import app, db
    
    with app.app_context():
        print(f"   ✅ Flask app initialized")
        print(f"   Database URI: {Config.SQLALCHEMY_DATABASE_URI[:50]}...")
        
        # Try to query tables
        try:
            result = db.session.execute(db.text("SELECT COUNT(*) FROM user"))
            count = result.scalar()
            print(f"   ✅ Flask-SQLAlchemy query successful: {count} users")
        except Exception as e:
            print(f"   ❌ Flask-SQLAlchemy query failed: {e}")

except Exception as e:
    print(f"   ❌ Flask app error: {e}")

print("\n" + "="*60)
print("Diagnostic Complete")
print("="*60 + "\n")
