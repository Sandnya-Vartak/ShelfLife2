import re
from datetime import timedelta

from flask import Blueprint, request, jsonify, make_response, current_app
from flask_jwt_extended import (
    jwt_required,
    get_jwt_identity,
    create_access_token,
    decode_token,
)
from werkzeug.security import generate_password_hash, check_password_hash

from database import db
from models import User
from utils import generate_access_token
from services import send_email


auth_bp = Blueprint('auth', __name__)
EMAIL_PATTERN = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def is_valid_email(email):
    return bool(EMAIL_PATTERN.fullmatch(email))


def is_valid_password(password):
    return bool(password and len(password) >= 8 and re.search(r"[A-Za-z]", password))


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')

    if not all([name, email, password]):
        return jsonify({'message': 'Missing fields'}), 400

    if not is_valid_email(email):
        return jsonify({'message': 'Enter a valid email address'}), 400

    if not is_valid_password(password):
        return jsonify({'message': 'Password must be at least 8 characters and include letters'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'message': 'User already exists'}), 400

    password_hash = generate_password_hash(password)
    user = User(name=name, email=email, password_hash=password_hash)
    db.session.add(user)
    db.session.commit()

    access_token = generate_access_token(user.id)
    response = make_response(jsonify({
        'message': 'User registered successfully',
        'access_token': access_token,
        'user': {
            'id': user.id,
            'name': user.name,
            'email': user.email
        }
    }), 201)
    response.set_cookie('shelflife_token', access_token, httponly=False, samesite='Lax', path='/')
    return response


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')

    if not all([email, password]):
        return jsonify({'message': 'Missing fields'}), 400

    if not is_valid_email(email):
        return jsonify({'message': 'Enter a valid email address'}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'message': 'Invalid credentials'}), 401

    access_token = generate_access_token(user.id)
    response = make_response(jsonify({'access_token': access_token}), 200)
    response.set_cookie('shelflife_token', access_token, httponly=False, samesite='Lax', path='/')
    return response


@auth_bp.route('/request-password-reset', methods=['POST'])
def request_password_reset():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()

    if not email or not is_valid_email(email):
        return jsonify({'message': 'Enter a valid email address'}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({
            'message': 'If an account exists for that email, a password reset link has been sent.'
        }), 200

    token = create_access_token(
        identity=str(user.id),
        expires_delta=timedelta(hours=1),
        additional_claims={'purpose': 'password_reset'}
    )

    base_url = current_app.config.get('FRONTEND_URL') or request.url_root.rstrip('/')
    reset_link = f"{base_url}/forgot-password/?token={token}"
    subject = "ShelfLife Password Reset"
    body = f"""
ShelfLife Password Reset
========================

We received a request to reset your password.

Use the link below to choose a new password (valid for 60 minutes):
{reset_link}

If you did not request this change, ignore this message.
"""
    send_email(user.email, subject, body)

    return jsonify({
        'message': 'If an account exists for that email, a password reset link has been sent.'
    }), 200


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json() or {}
    token = data.get('token')
    password = data.get('password')
    confirm_password = data.get('confirm_password')

    if not token or not password or not confirm_password:
        return jsonify({'message': 'Token and password are required'}), 400

    if password != confirm_password:
        return jsonify({'message': 'Passwords do not match'}), 400

    if not is_valid_password(password):
        return jsonify({'message': 'Password must be at least 8 characters and include letters'}), 400

    try:
        decoded = decode_token(token)
    except Exception:
        return jsonify({'message': 'Invalid or expired token'}), 400

    if decoded.get('purpose') != 'password_reset':
        return jsonify({'message': 'Invalid password reset token'}), 400

    user_id = decoded.get('sub')
    if not user_id:
        return jsonify({'message': 'Unable to resolve user'}), 400

    user = User.query.get(int(user_id))
    if not user:
        return jsonify({'message': 'User not found'}), 404

    user.password_hash = generate_password_hash(password)
    db.session.commit()

    return jsonify({'message': 'Password updated successfully. Please log in.'}), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404

    return jsonify({
        'id': user.id,
        'name': user.name,
        'email': user.email
    }), 200


@auth_bp.route('/profile', methods=['PATCH'])
@jwt_required()
def update_profile():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404

    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = (data.get('password') or '').strip()

    if not name or not email:
        return jsonify({'message': 'Name and email are required'}), 400

    if not is_valid_email(email):
        return jsonify({'message': 'Enter a valid email address'}), 400

    existing_user = User.query.filter(User.email == email, User.id != user_id).first()
    if existing_user:
        return jsonify({'message': 'Email is already in use'}), 400

    user.name = name
    user.email = email

    if password:
        user.password_hash = generate_password_hash(password)

    db.session.commit()

    return jsonify({
        'message': 'Profile updated successfully',
        'user': {
            'id': user.id,
            'name': user.name,
            'email': user.email
        }
    }), 200


@auth_bp.route('/logout', methods=['POST'])
def logout():
    response = make_response(jsonify({'message': 'Logged out successfully'}), 200)
    response.delete_cookie('shelflife_token', path='/')
    return response


@auth_bp.route('/delete-account', methods=['DELETE'])
@jwt_required()
def delete_account():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404

    db.session.delete(user)
    db.session.commit()

    response = make_response(jsonify({'message': 'Account deleted successfully'}), 200)
    response.delete_cookie('shelflife_token', path='/')
    return response
