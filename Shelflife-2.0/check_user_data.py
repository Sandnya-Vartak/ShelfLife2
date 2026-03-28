#!/usr/bin/env python
"""Check database for user, items, and notifications"""

from database import db
from app import app
from models import User, Item, Notification

app.app_context().push()

# Find user
user = User.query.filter_by(email='harshita2202singh@gmail.com').first()
if user:
    print(f"✅ User found: {user.name} (ID: {user.id})")
    
    # Check items
    items = Item.query.filter_by(user_id=user.id).all()
    print(f"\n📦 Items: {len(items)}")
    for item in items:
        print(f"   - {item.name} (expires: {item.expiry_date}, ID: {item.id})")
    
    # Check notifications
    notifications = Notification.query.filter_by(user_id=user.id).all()
    print(f"\n🔔 Notifications: {len(notifications)}")
    for notif in notifications:
        print(f"   - Status: {notif.status}")
        print(f"     Message: {notif.message}")
        print()
else:
    print("❌ User not found!")
