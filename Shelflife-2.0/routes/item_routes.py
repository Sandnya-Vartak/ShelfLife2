from datetime import datetime, date, timedelta
from decimal import Decimal, InvalidOperation

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from database import db
from models import Item, Notification, User
from services import (
    get_item_status,
    send_expiry_alert_email,
    upsert_item_notification,
    refresh_notifications_for_user,
    get_utilization_metrics,
)


inventory_bp = Blueprint('inventory', __name__)


SUPPORTED_CURRENCIES = {"USD", "EUR", "GBP", "INR", "CAD", "AUD"}


def parse_price_value(value):
    if value is None or str(value).strip() == "":
        return None
    try:
        price_decimal = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None

    if price_decimal < 0:
        return None

    return price_decimal


def parse_currency_value(value):
    candidate = (value or "").strip().upper()
    if not candidate:
        return "USD"
    if candidate in SUPPORTED_CURRENCIES:
        return candidate
    return None


def serialize_inventory_item(item):
    return {
        'id': item.id,
        'name': item.name,
        'category': item.category,
        'expiry_date': item.expiry_date.isoformat(),
        'status': get_item_status(item.expiry_date),
        'quantity': item.quantity,
        'price': float(item.price or 0),
        'currency': item.currency or 'USD',
        'is_consumed': bool(item.is_consumed),
        'consumed_at': item.consumed_at.isoformat() if item.consumed_at else None
    }


@inventory_bp.route('/add-item', methods=['POST'])
@jwt_required()
def add_item():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    name = data.get('name')
    category = data.get('category')
    expiry_date_str = data.get('expiry_date')
    expiry_days = data.get('expiry_days')
    quantity_value = data.get('quantity')
    currency_value = data.get('currency')
    currency_value = data.get('currency')
    price_value = data.get('price')

    quantity = 1
    try:
        parsed_quantity = int(quantity_value)
        if parsed_quantity > 0:
            quantity = parsed_quantity
    except (TypeError, ValueError):
        pass

    if not all([name, category]) or (not expiry_date_str and not expiry_days):
        return jsonify({'message': 'Missing fields'}), 400

    expiry_date = None
    if expiry_date_str:
        try:
            expiry_date = datetime.strptime(expiry_date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'message': 'Invalid date format. Use YYYY-MM-DD'}), 400
    elif expiry_days:
        try:
            offset_days = int(expiry_days)
            if offset_days < 0:
                raise ValueError("Days must be zero or positive")
            expiry_date = date.today() + timedelta(days=offset_days)
        except (TypeError, ValueError):
            return jsonify({'message': 'Invalid expiry days. Provide a non-negative integer.'}), 400
    else:
        return jsonify({'message': 'Missing expiry information'}), 400

    price_decimal = parse_price_value(price_value)
    if price_decimal is None:
        return jsonify({'message': 'Item price is required and must be a valid non-negative number.'}), 400

    currency_code = parse_currency_value(currency_value)
    if currency_code is None:
        return jsonify({'message': f'Currency must be one of {sorted(SUPPORTED_CURRENCIES)}'}), 400

    item = Item(
        name=name,
        category=category,
        expiry_date=expiry_date,
        user_id=user_id,
        price=price_decimal,
        currency=currency_code,
    )
    item.quantity = quantity
    db.session.add(item)
    db.session.commit()
    notification = upsert_item_notification(item)

    email_result = None
    item_status = get_item_status(expiry_date)
    if notification and item_status in {"expired", "expiring_critical", "expiring_soon"}:
        # Auto-trigger email for high-urgency items so users get immediate alerts.
        user = User.query.get(user_id)
        sent = bool(user and send_expiry_alert_email(user.email, notification.message, notification.status))
        email_result = {
            "ok": sent,
            "reason": "sent" if sent else "send_failed",
            "attempted": 1,
            "sent_messages": [notification.message] if sent else [],
        }

    return jsonify({
        'message': 'Item added successfully',
        'status': item_status,
        'quantity': item.quantity,
        'email': email_result
    }), 201


@inventory_bp.route('/items', methods=['GET'])
@jwt_required()
def get_items():
    user_id = int(get_jwt_identity())
    refresh_notifications_for_user(user_id)
    items = Item.query.filter_by(user_id=user_id).order_by(Item.expiry_date.asc()).all()
    items_list = [serialize_inventory_item(item) for item in items]
    return jsonify(items_list), 200


@inventory_bp.route('/item/<int:item_id>', methods=['GET'])
@jwt_required()
def get_item(item_id):
    user_id = int(get_jwt_identity())
    item = Item.query.filter_by(id=item_id, user_id=user_id).first()
    if not item:
        return jsonify({'message': 'Item not found'}), 404

    return jsonify(serialize_inventory_item(item)), 200


@inventory_bp.route('/delete-item/<int:item_id>', methods=['DELETE'])
@jwt_required()
def delete_item(item_id):
    user_id = int(get_jwt_identity())
    item = Item.query.filter_by(id=item_id, user_id=user_id).first()
    if not item:
        return jsonify({'message': 'Item not found'}), 404

    Notification.query.filter_by(item_id=item.id).delete()
    db.session.delete(item)
    db.session.commit()

    return jsonify({'message': 'Item deleted successfully'}), 200


@inventory_bp.route('/update-item/<int:item_id>', methods=['PATCH'])
@jwt_required()
def update_item(item_id):
    user_id = int(get_jwt_identity())
    item = Item.query.filter_by(id=item_id, user_id=user_id).first()
    if not item:
        return jsonify({'message': 'Item not found'}), 404

    data = request.get_json() or {}
    name = (data.get('name') or item.name).strip()
    category = (data.get('category') or item.category).strip()
    expiry_date_str = data.get('expiry_date')
    expiry_days = data.get('expiry_days')
    quantity_value = data.get('quantity')
    price_value = data.get('price')
    currency_value = data.get('currency')
    price_value = data.get('price')

    if not name or not category:
        return jsonify({'message': 'Name and category are required'}), 400

    expiry_date = item.expiry_date
    if expiry_date_str:
        try:
            expiry_date = datetime.strptime(expiry_date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'message': 'Invalid date format. Use YYYY-MM-DD'}), 400
    elif expiry_days is not None:
        try:
            offset_days = int(expiry_days)
            if offset_days < 0:
                raise ValueError("Days must be zero or positive")
            expiry_date = date.today() + timedelta(days=offset_days)
        except (TypeError, ValueError):
            return jsonify({'message': 'Invalid expiry days. Provide a non-negative integer.'}), 400

    quantity = item.quantity or 1
    try:
        parsed_quantity = int(quantity_value)
        if parsed_quantity > 0:
            quantity = parsed_quantity
    except (TypeError, ValueError):
        pass

    item.name = name
    item.category = category
    item.expiry_date = expiry_date
    item.quantity = quantity

    if price_value is None:
        return jsonify({'message': 'Item price is required for updates.'}), 400

    price_decimal = parse_price_value(price_value)
    if price_decimal is None:
        return jsonify({'message': 'Provide a valid non-negative price when updating.'}), 400

    item.price = price_decimal

    if currency_value is None:
        return jsonify({'message': 'Currency selection is required when updating.'}), 400

    currency_code = parse_currency_value(currency_value)
    if currency_code is None:
        return jsonify({'message': f'Currency must be one of {sorted(SUPPORTED_CURRENCIES)}'}), 400

    item.currency = currency_code
    db.session.commit()

    notification = upsert_item_notification(item)
    item_status = get_item_status(expiry_date)
    email_result = None
    if notification and item_status in {"expired", "expiring_critical", "expiring_soon"}:
        user = User.query.get(user_id)
        sent = bool(user and send_expiry_alert_email(user.email, notification.message, notification.status))
        email_result = {
            "ok": sent,
            "reason": "sent" if sent else "send_failed",
            "attempted": 1,
            "sent_messages": [notification.message] if sent else [],
        }

    return jsonify({
        'message': 'Item updated successfully',
        'status': item_status,
        'quantity': item.quantity,
        'email': email_result
    }), 200


@inventory_bp.route('/pantry', methods=['GET'])
@jwt_required()
def get_pantry_items():
    user_id = int(get_jwt_identity())
    items = Item.query.filter_by(user_id=user_id).order_by(Item.expiry_date.desc()).all()
    return jsonify([serialize_inventory_item(item) for item in items]), 200


@inventory_bp.route('/utilization', methods=['GET'])
@jwt_required()
def get_utilization_metrics_endpoint():
    user_id = int(get_jwt_identity())
    metrics = get_utilization_metrics(user_id)
    return jsonify(metrics), 200
