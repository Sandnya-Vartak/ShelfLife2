#!/usr/bin/env python3
"""
API Test Script for ShelfLife Pantry Manager
Run this to test all endpoints
"""

import requests
import json
import sys

BASE_URL = "http://localhost:5000"
token = None

def test_endpoint(method, endpoint, data=None, headers=None):
    """Test a single endpoint"""
    url = f"{BASE_URL}{endpoint}"
    default_headers = {"Content-Type": "application/json"}
    
    if headers:
        default_headers.update(headers)
    
    try:
        if method == "GET":
            response = requests.get(url, headers=default_headers)
        elif method == "POST":
            response = requests.post(url, json=data, headers=default_headers)
        else:
            response = requests.request(method, url, json=data, headers=default_headers)
        
        status = "✅" if response.status_code < 400 else "❌"
        print(f"{status} {method} {endpoint} → {response.status_code}")
        
        try:
            print(f"   Response: {json.dumps(response.json(), indent=2)}")
        except:
            print(f"   Response: {response.text[:200]}")
        
        return response
    except Exception as e:
        print(f"❌ {method} {endpoint} → ERROR: {str(e)}")
        return None

def main():
    print(f"\n🧪 Testing ShelfLife API (Base URL: {BASE_URL})\n")
    
    # Test 1: Register
    print("1️⃣  Testing User Registration...")
    resp = test_endpoint("POST", "/auth/register", {
        "name": "Test User",
        "email": "test@example.com",
        "password": "Test123!"
    })
    
    # Test 2: Login
    print("\n2️⃣  Testing User Login...")
    resp = test_endpoint("POST", "/auth/login", {
        "email": "test@example.com",
        "password": "Test123!"
    })
    
    if resp and resp.status_code == 200:
        try:
            token = resp.json().get('access_token')
            print(f"   Token obtained: {token[:20]}...")
        except:
            pass
    
    # Test 3: Get User Profile
    if token:
        print("\n3️⃣  Testing Get User Profile...")
        test_endpoint("GET", "/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
    
    # Test 4: Get Items
    if token:
        print("\n4️⃣  Testing Get Inventory Items...")
        test_endpoint("GET", "/inventory/items", headers={
            "Authorization": f"Bearer {token}"
        })
    
    # Test 5: Add Item
    if token:
        print("\n5️⃣  Testing Add Item...")
        test_endpoint("POST", "/inventory/add-item", {
            "name": "Milk",
            "expiry_date": "2026-04-01",
            "quantity": 1,
            "unit": "Liter"
        }, headers={
            "Authorization": f"Bearer {token}"
        })
    
    print("\n✨ API Testing Complete!\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(0)
