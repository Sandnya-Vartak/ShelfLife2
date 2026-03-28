from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation

from database import db
from models import Item, Notification, User
from core.email_service import send_expiry_alert_email

EXPIRY_GRACE_DAYS = 3
WASTED_ALERT_RETENTION_DAYS = 1


def safe_decimal(value):
    if value is None:
        return Decimal("0")
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0")


def format_item_total(item):
    quantity = Decimal(item.quantity or 1)
    total = safe_decimal(item.price) * quantity
    currency = (item.currency or "USD").upper()
    return f"{currency} {total.quantize(Decimal('0.01'))}"


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


def build_expired_grace_message(item):
    days_overdue = (date.today() - item.expiry_date).days
    remaining_days = max(EXPIRY_GRACE_DAYS - days_overdue, 0)
    if remaining_days == 0:
        return (
            f"{item.name} expired on {item.expiry_date.isoformat()}. "
            "Last day to mark it consumed or update the expiry before it is counted as wasted."
        )
    day_word = "day" if remaining_days == 1 else "days"
    return (
        f"{item.name} expired on {item.expiry_date.isoformat()}. "
        f"You still have {remaining_days} {day_word} to mark it consumed or fix the expiry date."
    )


def build_wasted_message(item):
    return (
        f"You wasted {format_item_total(item)} on {item.name}. "
        "This alert will disappear automatically after a short time."
    )


def upsert_item_notification(item):
    if item.is_consumed:
        Notification.query.filter_by(item_id=item.id).delete()
        db.session.commit()
        return None

    days_remaining = (item.expiry_date - date.today()).days
    status = get_item_status(item.expiry_date)
    wasted_at = None
    if status == "fresh":
        Notification.query.filter_by(item_id=item.id).delete()
        db.session.commit()
        return None

    if status == "expired":
        days_overdue = abs(days_remaining)
        if days_overdue <= EXPIRY_GRACE_DAYS:
            message = build_expired_grace_message(item)
        else:
            status = "wasted"
            message = build_wasted_message(item)
            wasted_at = datetime.utcnow()
    else:
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
        if notification.status != status or notification.message != message:
            notification.last_emailed_at = None
        notification.message = message
        notification.status = status
        if status == "wasted":
            notification.wasted_at = notification.wasted_at or wasted_at
        else:
            notification.wasted_at = None
    else:
        notification = Notification(
            message=message,
            status=status,
            user_id=item.user_id,
            item_id=item.id,
            wasted_at=wasted_at,
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
    today = date.today()
    stale_expiry_cutoff = today - timedelta(days=EXPIRY_GRACE_DAYS + WASTED_ALERT_RETENTION_DAYS + 1)

    for notification in notifications:
        item = Item.query.filter_by(id=notification.item_id, user_id=user_id).first()
        if not item:
            db.session.delete(notification)
            deleted += 1
            continue

        should_delete = notification.is_consumed or item.is_consumed

        if not should_delete and notification.status == "wasted":
            wasted_reference = notification.wasted_at or notification.created_at
            if wasted_reference and today >= (wasted_reference.date() + timedelta(days=WASTED_ALERT_RETENTION_DAYS)):
                should_delete = True

        if not should_delete and item.expiry_date and item.expiry_date < stale_expiry_cutoff:
            should_delete = True

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

        refresh_notifications_for_user(user_id)
        cleanup_notifications_for_user(user_id)
        notifications = (
            Notification.query
            .filter_by(user_id=user_id)
            .order_by(Notification.id.asc())
            .all()
        )
        unique_notifications = []
        seen_notification_keys = set()
        for notification in notifications:
            if notification.status not in {"expiring_soon", "expiring_critical"}:
                continue
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

        pending_notifications = []
        today = date.today()
        for notification in unique_notifications:
            last_emailed_at = notification.last_emailed_at.date() if notification.last_emailed_at else None
            if last_emailed_at == today:
                continue
            pending_notifications.append(notification)

        meta["attempted"] = len(pending_notifications)
        if not pending_notifications:
            meta["ok"] = True
            meta["reason"] = "already_sent_today"
            return meta if include_meta else []

        sent_messages = []
        email_sent_at = datetime.utcnow()
        for notification in pending_notifications:
            try:
                result = send_expiry_alert_email(user.email, notification.message, notification.status)
                if result:
                    notification.last_emailed_at = email_sent_at
                    sent_messages.append(notification.message)
            except Exception as error:
                print(f"[error] Failed to send email for user {user_id}: {error}")
                continue

        if sent_messages:
            db.session.commit()

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
