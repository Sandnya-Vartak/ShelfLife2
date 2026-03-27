#!/usr/bin/env python
"""Test API flow: register, login, add item"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:5000"

print("\n" + "="*60)
print("Testing ShelfLife API Flow")
print("="*60)

# Test 1: Register a new user
print("\n[1] Registering new user...")
test_email = f"testuser_{datetime.now().timestamp()}@test.com"
register_data = {
    "name": "Test User",
    "email": test_email,
    "password": "password123"
}

try:
    response = requests.post(f"{BASE_URL}/auth/register", json=register_data)
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    
    if response.status_code != 201:
        print("   ❌ Registration failed!")
        exit(1)
    else:
        print("   ✅ Registration successful!")
except Exception as e:
    print(f"   ❌ Error: {e}")
    exit(1)

# Test 2: Login
print("\n[2] Logging in...")
login_data = {
    "email": test_email,
    "password": "password123"
}

try:
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    
    if response.status_code != 200:
        print("   ❌ Login failed!")
        exit(1)
    
    access_token = response.json().get('access_token')
    print(f"   ✅ Login successful! Token: {access_token[:20]}...")
except Exception as e:
    print(f"   ❌ Error: {e}")
    exit(1)

# Test 3: Add an item
print("\n[3] Adding an item...")
expiry_date = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
item_data = {
    "name": "Test Item",
    "category": "Dairy",
    "expiry_date": expiry_date
}

headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

try:
    response = requests.post(f"{BASE_URL}/inventory/add-item", json=item_data, headers=headers)
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    
    if response.status_code != 201:
        print("   ❌ Add item failed!")
    else:
        print("   ✅ Item added successfully!")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 4: Get items
print("\n[4] Retrieving items...")
try:
    response = requests.get(f"{BASE_URL}/inventory/items", headers=headers)
    print(f"   Status: {response.status_code}")
    items = response.json()
    print(f"   Items found: {len(items)}")
    if items:
        print(f"   ✅ Items retrieved successfully!")
        print(f"   Items: {json.dumps(items, indent=2)}")
    else:
        print("   ❌ No items found in database!")
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n" + "="*60)
