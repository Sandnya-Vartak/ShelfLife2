from app import app, db
from flask import json

data = {'name': 'Tester', 'email': 'test@example.com', 'password': 'Password123'}
with app.app_context():
    db.session.close()
    db.drop_all()
    db.create_all()
print('DB initialized')
with app.test_client() as client:
    client.post('/auth/register', json=data)
    login = client.post('/auth/login', json={'email': data['email'], 'password': data['password']})
    token = login.get_json().get('access_token')
    headers = {'Authorization': f'Bearer {token}'}
    add = client.post('/inventory/add-item', json={'name': 'Bread', 'category': 'Bakery', 'expiry_days': 2}, headers=headers)
    print('add', add.status_code, add.get_json())
