#!/usr/bin/env python
"""Manually send email for harshita user"""

from app import app
from models import User
from utils import generate_access_token
from services import send_expiry_emails_for_user

app.app_context().push()

# Find user
user = User.query.filter_by(email='harshita2202singh@gmail.com').first()
if user:
    print(f"✅ Found user: {user.name} (ID: {user.id})")
    print("\n📧 Sending expiry emails...")
    
    # Send emails
    sent = send_expiry_emails_for_user(user.id)
    
    print(f"\n✅ Email sending triggered!")
    print(f"Messages sent: {len(sent)}")
    for msg in sent:
        print(f"   - {msg}")
else:
    print("❌ User not found!")
