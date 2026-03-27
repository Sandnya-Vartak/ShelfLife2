from flask import current_app
from flask_mail import Mail, Message


mail = Mail()


def _has_real_mail_credentials(app):
    username = (app.config.get("MAIL_USERNAME") or "").strip()
    password = (app.config.get("MAIL_PASSWORD") or "").strip()
    placeholder_values = {
        "",
        "your_email@gmail.com",
        "your_app_password",
    }
    return username not in placeholder_values and password not in placeholder_values


def _has_real_sendgrid_credentials(app):
    api_key = (app.config.get("SENDGRID_API_KEY") or "").strip()
    from_email = (app.config.get("SENDGRID_FROM_EMAIL") or "").strip()
    return bool(api_key and from_email and api_key.lower().startswith("sg."))


def _get_sender_identity(app, formatted=False):
    sender_email = (
        app.config.get("SENDGRID_FROM_EMAIL")
        or app.config.get("MAIL_DEFAULT_SENDER")
        or app.config.get("MAIL_USERNAME")
        or ""
    ).strip()
    sender_name = (app.config.get("MAIL_SENDER_NAME") or "Shelf Life").strip()

    if formatted:
        return f"{sender_name} <{sender_email}>"

    return (sender_name, sender_email)


def _resolve_provider(app):
    provider = (app.config.get("EMAIL_PROVIDER") or "auto").strip().lower()
    if provider in {"sendgrid", "smtp"}:
        return provider
    if _has_real_sendgrid_credentials(app):
        return "sendgrid"
    return "smtp"


def _send_with_sendgrid(app, to, subject, body):
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail as SendGridMail
    except Exception:
        print("[warn] sendgrid package is missing. Run: pip install sendgrid")
        return False

    api_key = (app.config.get("SENDGRID_API_KEY") or "").strip()
    from_email = _get_sender_identity(app, formatted=True)
    message = SendGridMail(
        from_email=from_email,
        to_emails=to,
        subject=subject,
        html_content=body.replace("\n", "<br>"),
    )
    client = SendGridAPIClient(api_key)
    response = client.send(message)
    if 200 <= response.status_code < 300:
        print(f"[ok] Email sent to {to} via SendGrid: {subject}")
        return True
    print(f"[error] SendGrid failed for {to}. Status: {response.status_code}")
    return False


def _send_with_smtp(app, to, subject, body):
    if not _has_real_mail_credentials(app):
        print("[warn] SMTP credentials not configured. Set MAIL_USERNAME and MAIL_PASSWORD in .env.")
        return False

    msg = Message(subject, recipients=[to], body=body, sender=_get_sender_identity(app))
    mail.send(msg)
    print(f"[ok] Email sent to {to} via SMTP: {subject}")
    return True


def send_email(to, subject, body):
    """Send email and return True only when provider actually sends it."""
    try:
        app = current_app._get_current_object()

        if not to or "@" not in str(to):
            print(f"[warn] Invalid email address: {to}")
            return False

        if app.config.get("MAIL_TEST_MODE"):
            print(f"[warn] MAIL_TEST_MODE is enabled. Skipping real email to {to}.")
            print(f"[info] Subject: {subject}")
            return False

        provider = _resolve_provider(app)
        if provider == "sendgrid":
            if not _has_real_sendgrid_credentials(app):
                print("[warn] SendGrid not configured. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL in .env.")
                return False
            return _send_with_sendgrid(app, to, subject, body)
        return _send_with_smtp(app, to, subject, body)
    except Exception as error:
        print(f"[error] Email sending failed for {to}: {error}")
        return False


def send_expiry_alert_email(to, message, status):
    try:
        subject_map = {
            "expired": "ShelfLife Alert: Item Expired",
            "expiring_critical": "ShelfLife Alert: Expires Today/Tomorrow",
            "expiring_soon": "ShelfLife Alert: Use Soon (2-3 Days)",
            "fresh": "ShelfLife Update",
        }
        subject = subject_map.get(status, "ShelfLife Notification")

        email_body = f"""
ShelfLife Expiry Alert
=====================

{message}

Please check your pantry and use items expiring soon.

Don't waste food - manage your inventory with ShelfLife!
"""
        return send_email(to, subject, email_body)
    except Exception as error:
        print(f"[error] Error preparing email: {error}")
        return False
