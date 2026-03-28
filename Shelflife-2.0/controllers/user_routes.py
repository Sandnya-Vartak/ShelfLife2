import re
from datetime import timedelta

from flask import Blueprint, request, jsonify, make_response, current_app
from flask_jwt_extended import (
    jwt_required,
    get_jwt_identity,
    create_access_token,
    decode_token,
)
from werkzeug.security import check_password_hash, generate_password_hash

from database import db
from models import User
from core import send_email, get_last_mail_error
from helpers import generate_access_token


auth_bp = Blueprint("auth", __name__)
EMAIL_PATTERN = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def sanitize_email(value):
    return (value or "").strip().lower()


def respond_error(message, status=400):
    return jsonify({"message": message}), status


def respond_with_data(payload, status=200):
    return jsonify(payload), status


def build_user_summary(user):
    return {"id": user.id, "name": user.name, "email": user.email}


def attach_token_cookie(response, token):
    response.set_cookie(
        "shelflife_token",
        token,
        httponly=False,
        samesite="Lax",
        path="/",
    )
    return response


def is_valid_email(email):
    return bool(EMAIL_PATTERN.fullmatch(email))


def is_valid_password(password):
    return bool(password and len(password) >= 8 and re.search(r"[A-Za-z]", password))


@auth_bp.route("/register", methods=["POST"])
def register_user():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    email = sanitize_email(data.get("email"))
    password = data.get("password")

    if not all([name, email, password]):
        return respond_error("Missing fields")

    if not is_valid_email(email):
        return respond_error("Enter a valid email address")

    if not is_valid_password(password):
        return respond_error("Password must be at least 8 characters and include letters")

    if User.query.filter_by(email=email).first():
        return respond_error("User already exists")

    password_hash = generate_password_hash(password)
    user = User(name=name, email=email, password_hash=password_hash)
    db.session.add(user)
    db.session.commit()

    access_token = generate_access_token(user.id)
    response_payload = {
        "message": "User registered successfully",
        "access_token": access_token,
        "user": build_user_summary(user),
    }
    response = make_response(jsonify(response_payload), 201)
    attach_token_cookie(response, access_token)
    return response


@auth_bp.route("/login", methods=["POST"])
def authenticate_user():
    data = request.get_json() or {}
    email = sanitize_email(data.get("email"))
    password = data.get("password")

    if not all([email, password]):
        return respond_error("Missing fields")

    if not is_valid_email(email):
        return respond_error("Enter a valid email address")

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return respond_error("Invalid credentials", 401)

    access_token = generate_access_token(user.id)
    response = make_response(jsonify({"access_token": access_token}), 200)
    attach_token_cookie(response, access_token)
    return response


@auth_bp.route("/request-password-reset", methods=["POST"])
def request_password_reset_email():
    data = request.get_json() or {}
    email = sanitize_email(data.get("email"))

    if not email or not is_valid_email(email):
        return respond_error("Enter a valid email address")

    user = User.query.filter_by(email=email).first()
    if not user:
        return respond_with_data({
            'message': 'If an account exists for that email, a password reset link has been sent.'
        })

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
    sent = send_email(user.email, subject, body)
    if not sent:
        details = get_last_mail_error()
        if current_app.debug and details:
            return respond_error(f"Password reset email could not be sent: {details}", 500)
        return respond_error("Password reset email could not be sent. Check mail settings and try again.", 500)

    return respond_with_data({
        'message': 'If an account exists for that email, a password reset link has been sent.'
    })


@auth_bp.route("/reset-password", methods=["POST"])
def perform_password_reset():
    data = request.get_json() or {}
    token = data.get("token")
    password = data.get("password")
    confirm_password = data.get("confirm_password")

    if not token or not password or not confirm_password:
        return respond_error("Token and password are required")

    if password != confirm_password:
        return respond_error("Passwords do not match")

    if not is_valid_password(password):
        return respond_error("Password must be at least 8 characters and include letters")

    try:
        decoded = decode_token(token)
    except Exception:
        return respond_error("Invalid or expired token")

    if decoded.get("purpose") != "password_reset":
        return respond_error("Invalid password reset token")

    user_id = decoded.get("sub")
    if not user_id:
        return respond_error("Unable to resolve user")

    user = User.query.get(int(user_id))
    if not user:
        return respond_error("User not found", 404)

    user.password_hash = generate_password_hash(password)
    db.session.commit()

    return respond_with_data({"message": "Password updated successfully. Please log in."})


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def fetch_current_user():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return respond_error("User not found", 404)

    return respond_with_data(build_user_summary(user))


@auth_bp.route("/profile", methods=["PATCH"])
@jwt_required()
def update_user_profile():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return respond_error("User not found", 404)

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    email = sanitize_email(data.get("email"))
    password = (data.get("password") or "").strip()

    if not name or not email:
        return respond_error("Name and email are required")

    if not is_valid_email(email):
        return respond_error("Enter a valid email address")

    existing_user = User.query.filter(User.email == email, User.id != user_id).first()
    if existing_user:
        return respond_error("Email is already in use")

    user.name = name
    user.email = email

    if password:
        if not is_valid_password(password):
            return respond_error("Password must be at least 8 characters and include letters")
        user.password_hash = generate_password_hash(password)

    db.session.commit()

    return respond_with_data({
        "message": "Profile updated successfully",
        "user": build_user_summary(user),
    })


@auth_bp.route("/logout", methods=["POST"])
def logout_user():
    response = make_response(jsonify({"message": "Logged out successfully"}), 200)
    response.delete_cookie("shelflife_token", path="/")
    return response


@auth_bp.route("/delete-account", methods=["DELETE"])
@jwt_required()
def remove_account():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return respond_error("User not found", 404)

    db.session.delete(user)
    db.session.commit()

    response = make_response(jsonify({"message": "Account deleted successfully"}), 200)
    response.delete_cookie("shelflife_token", path="/")
    return response
