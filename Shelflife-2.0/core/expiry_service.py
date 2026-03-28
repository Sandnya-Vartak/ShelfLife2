from datetime import date, timedelta

from database import db
from models import Item, Notification, User
from core.email_service import send_expiry_alert_email


def get_item_status(expiry_date):
    days_remaining = (expiry_date - date.today()).days
    if days_remaining < 0:
        return "expired"
    if days_remaining <= 1:
        return "expiring_critical"
    if days_remaining <= 3:
        return "expiring_soon"
    return "fresh"


def build_notification_message(item):
    days_remaining = (item.expiry_date - date.today()).days
    if days_remaining < 0:
        return f"{item.name} expired on {item.expiry_date.isoformat()}"
    if days_remaining == 0:
        return f"{item.name} expires TODAY"
    if days_remaining == 1:
        return f"{item.name} expires TOMORROW"
    if days_remaining <= 3:
        return f"{item.name} expires in {days_remaining} days - Use it soon!"
    return f"{item.name} expires in {days_remaining} days"


def upsert_item_notification(item):
    status = get_item_status(item.expiry_date)
    if status == "fresh":
        Notification.query.filter_by(item_id=item.id).delete()
        db.session.commit()
        return None

    message = build_notification_message(item)
    existing_notifications = (
        Notification.query
        .filter_by(item_id=item.id)
        .order_by(Notification.id.asc())
        .all()
    )
    if existing_notifications:
        # Keep the oldest row and remove any accidental duplicates for the same item.
        notification = existing_notifications[0]
        for duplicate in existing_notifications[1:]:
            db.session.delete(duplicate)
        notification.message = message
        notification.status = status
    else:
        notification = Notification(
            message=message,
            status=status,
            user_id=item.user_id,
            item_id=item.id,
        )
        db.session.add(notification)

    db.session.commit()
    return notification


def refresh_notifications_for_user(user_id):
    items = Item.query.filter_by(user_id=user_id).all()
    notifications = []
    for item in items:
        notification = upsert_item_notification(item)
        if notification:
            notifications.append(notification)
    return notifications


def cleanup_notifications_for_user(user_id):
    notifications = Notification.query.filter_by(user_id=user_id).all()
    deleted = 0
    retention_days = 2
    cutoff_date = date.today() - timedelta(days=retention_days)

    for notification in notifications:
        item = Item.query.filter_by(id=notification.item_id, user_id=user_id).first()
        if not item:
            db.session.delete(notification)
            deleted += 1
            continue

        expiry_date = item.expiry_date
        should_delete = (
            notification.is_consumed
            or (expiry_date and expiry_date < cutoff_date)
        )

        if should_delete:
            db.session.delete(notification)
            deleted += 1

    if deleted:
        db.session.commit()

    return deleted


def send_expiry_emails_for_user(user_id, include_meta=False):
    """Send expiry emails for a user.

    include_meta=False keeps the original list return type.
    include_meta=True returns diagnostics used by API responses.
    """
    meta = {
        "ok": False,
        "reason": "internal_error",
        "attempted": 0,
        "sent_messages": [],
    }

    try:
        user = User.query.get(user_id)
        if not user:
            meta["reason"] = "user_not_found"
            return meta if include_meta else []

        notifications = refresh_notifications_for_user(user_id)
        unique_notifications = []
        seen_notification_keys = set()
        for notification in notifications:
            key = (notification.status, notification.message)
            if key in seen_notification_keys:
                continue
            seen_notification_keys.add(key)
            unique_notifications.append(notification)

        meta["attempted"] = len(unique_notifications)
        if not unique_notifications:
            meta["ok"] = True
            meta["reason"] = "no_notifications"
            return meta if include_meta else []

        sent_messages = []
        for notification in unique_notifications:
            try:
                result = send_expiry_alert_email(user.email, notification.message, notification.status)
                if result:
                    sent_messages.append(notification.message)
            except Exception as error:
                print(f"[error] Failed to send email for user {user_id}: {error}")
                continue

        meta["sent_messages"] = sent_messages
        if sent_messages:
            meta["ok"] = True
            meta["reason"] = "sent"
            return meta if include_meta else sent_messages

        from flask import current_app

        mail_test_mode = bool(current_app.config.get("MAIL_TEST_MODE"))
        provider = (current_app.config.get("EMAIL_PROVIDER") or "auto").strip().lower()
        mail_username = (current_app.config.get("MAIL_USERNAME") or "").strip()
        mail_password = (current_app.config.get("MAIL_PASSWORD") or "").strip()
        sendgrid_api_key = (current_app.config.get("SENDGRID_API_KEY") or "").strip()
        sendgrid_from_email = (current_app.config.get("SENDGRID_FROM_EMAIL") or "").strip()

        if mail_test_mode:
            meta["reason"] = "mail_test_mode"
        elif provider == "sendgrid" and (not sendgrid_api_key or not sendgrid_from_email):
            meta["reason"] = "sendgrid_credentials_missing"
        elif provider == "smtp" and (not mail_username or not mail_password):
            meta["reason"] = "mail_credentials_missing"
        elif provider == "auto" and not ((sendgrid_api_key and sendgrid_from_email) or (mail_username and mail_password)):
            meta["reason"] = "mail_credentials_missing"
        else:
            meta["reason"] = "send_failed"

        return meta if include_meta else []
    except Exception as error:
        print(f"[error] Error in send_expiry_emails_for_user: {error}")
        return meta if include_meta else []


def process_all_users_expiry_notifications():
    try:
        users = User.query.all()
        result = []
        for user in users:
            try:
                send_result = send_expiry_emails_for_user(user.id, include_meta=True)
                result.append(
                    {
                        "user_id": user.id,
                        "sent": send_result.get("sent_messages", []),
                        "reason": send_result.get("reason"),
                        "attempted": send_result.get("attempted", 0),
                    }
                )
            except Exception as error:
                print(f"[error] Error processing user {user.id}: {error}")
                continue
        print(f"[ok] Expiry notification job completed. Processed {len(users)} users")
        return result
    except Exception as error:
        print(f"[error] Error in process_all_users_expiry_notifications: {error}")
        return []
