from core import process_all_users_expiry_notifications


def run_daily_expiry_job():
    return process_all_users_expiry_notifications()


if __name__ == "__main__":
    from app import app

    with app.app_context():
        result = run_daily_expiry_job()
        print(result)
