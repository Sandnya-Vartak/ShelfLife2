from app import app
from services import process_all_users_expiry_notifications

with app.app_context():
    result = process_all_users_expiry_notifications()
    print('result', result)
