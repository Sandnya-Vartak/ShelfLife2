#!/usr/bin/env python
"""Check database for user, items, and notifications"""

from database import db
from app import app
from models import User, Item, Notification

app.app_context().push()

# Replace with the email of the user you want to inspect
TARGET_EMAIL = "your_email@example.com"

user = User.query.filter_by(email=TARGET_EMAIL).first()
if user:
    print(f"User found: {user.name} (ID: {user.id})")

    items = Item.query.filter_by(user_id=user.id).all()
    print(f"\nItems: {len(items)}")
    for item in items:
        print(f"   - {item.name} (expires: {item.expiry_date}, ID: {item.id})")

    notifications = Notification.query.filter_by(user_id=user.id).all()
    print(f"\nNotifications: {len(notifications)}")
    for notif in notifications:
        print(f"   - Status: {notif.status}")
        print(f"     Message: {notif.message}")
        print()
else:
    print("User not found!")
