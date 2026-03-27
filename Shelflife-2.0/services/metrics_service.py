from datetime import date
from decimal import Decimal, InvalidOperation

from models import Item, Notification


def safe_decimal(value):
    if value is None:
        return Decimal("0")
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal("0")


def item_total_cost(item):
    unit_price = safe_decimal(item.price)
    quantity = Decimal(item.quantity or 1)
    return unit_price * quantity


def is_consumed_before_expiry(item):
    if not item.is_consumed:
        return False
    if not item.consumed_at:
        return True
    try:
        return item.consumed_at.date() <= item.expiry_date
    except Exception:
        return False


def to_float(value):
    try:
        return float(value.quantize(Decimal("0.01")))
    except Exception:
        return float(value)


def dominant_currency(items):
    if not items:
        return "USD"
    counts = {}
    for item in items:
        code = (item.currency or "USD").upper()
        counts[code] = counts.get(code, 0) + 1
    return max(counts.items(), key=lambda pair: (pair[1], pair[0]))[0]


def get_consumption_summary(user_id):
    today = date.today()
    items = Item.query.filter_by(user_id=user_id).all()
    notifications = Notification.query.filter_by(user_id=user_id).order_by(Notification.created_at.desc()).all()

    consumed_items = [item for item in items if item.is_consumed]
    expired_items = [item for item in items if item.expiry_date < today and not item.is_consumed]
    read_not_consumed = [notif for notif in notifications if notif.is_read and not notif.is_consumed]

    summary = {
        "items_consumed": len(consumed_items),
        "items_expired": len(expired_items),
        "items_read_not_consumed": len(read_not_consumed),
        "food_waste_prevented": sum(1 for item in consumed_items if is_consumed_before_expiry(item)),
        "wasted_alerts": [
            {
                "id": notif.id,
                "message": notif.message,
                "status": notif.status,
                "read_at": notif.read_at.isoformat() if notif.read_at else None,
                "created_at": notif.created_at.isoformat() if notif.created_at else None,
                "item_name": notif.item.name if notif.item else None,
            }
            for notif in read_not_consumed[:10]
        ],
    }

    return summary


def get_utilization_metrics(user_id):
    today = date.today()
    items = Item.query.filter_by(user_id=user_id).all()

    total_spent = sum(item_total_cost(item) for item in items)
    expired_items = [item for item in items if item.expiry_date < today and not item.is_consumed]
    consumed_items = [item for item in items if item.is_consumed]

    wasted_money = sum(item_total_cost(item) for item in expired_items)
    saved_money = sum(item_total_cost(item) for item in consumed_items if is_consumed_before_expiry(item))

    currency_code = dominant_currency(items)

    return {
        "total_spent": to_float(total_spent),
        "money_wasted": to_float(wasted_money),
        "money_saved": to_float(saved_money),
        "expired_items": len(expired_items),
        "consumed_items": len(consumed_items),
        "currency": currency_code,
    }
