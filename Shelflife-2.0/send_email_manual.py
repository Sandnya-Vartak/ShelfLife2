#!/usr/bin/env python
"""Manually trigger expiry emails for a specific user"""

from app import app
from models import User
from core import send_expiry_emails_for_user

app.app_context().push()

# Replace with the email of the user you want to notify
TARGET_EMAIL = "your_email@example.com"

user = User.query.filter_by(email=TARGET_EMAIL).first()
if user:
    print(f"Found user: {user.name} (ID: {user.id})")
    print("\nSending expiry emails...")

    result = send_expiry_emails_for_user(user.id, include_meta=True)

    sent = result.get("sent_messages", [])
    print(f"\nEmail sending complete!")
    print(f"Messages sent: {len(sent)}")
    for msg in sent:
        print(f"   - {msg}")
else:
    print("User not found!")
