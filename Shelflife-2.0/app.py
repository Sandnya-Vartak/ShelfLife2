import os

from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from config import Config
from database import db, ensure_quantity_column
from models import Item, Notification, User
from routes import auth_bp, inventory_bp, notification_bp
from scheduler import run_daily_expiry_job
from services import mail


app = Flask(__name__)
app.config.from_object(Config)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
CSS_DIR = os.path.join(BASE_DIR, "css")
JS_DIR = os.path.join(BASE_DIR, "js")
ASSETS_DIR = os.path.join(BASE_DIR, "assets")

db.init_app(app)
ensure_quantity_column(app)
jwt = JWTManager(app)

try:
    mail.init_app(app)
    provider = app.config.get("EMAIL_PROVIDER", "auto")
    if app.config.get("MAIL_TEST_MODE"):
        print("[warn] Mail service is running in test mode. Real emails are disabled.")
    elif provider == "sendgrid" and app.config.get("SENDGRID_API_KEY"):
        print("[ok] Mail service initialized with SendGrid")
    elif app.config.get("MAIL_USERNAME") and app.config.get("MAIL_PASSWORD"):
        print("[ok] Mail service initialized with SMTP credentials")
    else:
        print("[warn] Mail service: Credentials not configured. Email will not be sent.")
except Exception as error:
    print(f"[warn] Mail service initialization warning: {error}")

CORS(
    app,
    resources={
        r"/auth/*": {"origins": "*"},
        r"/inventory/*": {"origins": "*"},
        r"/alerts/*": {"origins": "*"},
    },
    supports_credentials=True,
)

app.register_blueprint(auth_bp, url_prefix="/auth")
app.register_blueprint(inventory_bp, url_prefix="/inventory")
app.register_blueprint(notification_bp, url_prefix="/alerts")

scheduler = BackgroundScheduler()


@app.route("/css/<path:filename>")
def css_files(filename):
    return send_from_directory(CSS_DIR, filename)


@app.route("/js/<path:filename>")
def js_files(filename):
    return send_from_directory(JS_DIR, filename)


@app.route("/assets/<path:filename>")
def asset_files(filename):
    return send_from_directory(ASSETS_DIR, filename)


@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "landing.html")


@app.route("/register")
@app.route("/register/")
def register_page():
    return send_from_directory(FRONTEND_DIR, "register.html")


@app.route("/login")
@app.route("/login/")
def login_page():
    return send_from_directory(FRONTEND_DIR, "login.html")


@app.route("/dashboard")
@app.route("/dashboard/")
def dashboard_page():
    return send_from_directory(FRONTEND_DIR, "dashboard.html")


@app.route("/add-item")
@app.route("/add-item/")
def add_item_page():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/notifications")
@app.route("/notifications/")
def notifications_page():
    return send_from_directory(FRONTEND_DIR, "notification.html")


@app.route("/pantry")
@app.route("/pantry/")
def pantry_page():
    return send_from_directory(FRONTEND_DIR, "pantry.html")


@app.route("/utilization")
@app.route("/utilization/")
def utilization_page():
    return send_from_directory(FRONTEND_DIR, "utilization.html")


@app.route("/consumption-summary")
@app.route("/consumption-summary/")
def consumption_summary_page():
    return send_from_directory(FRONTEND_DIR, "consumption_summary.html")


@app.route("/forgot-password")
@app.route("/forgot-password/")
def forgot_password_page():
    return send_from_directory(FRONTEND_DIR, "forgot_password.html")


@app.route("/research-guide")
@app.route("/research-guide/")
def research_guide_page():
    return send_from_directory(FRONTEND_DIR, "research_guide.html")


@app.route("/edit-item/<int:item_id>")
@app.route("/edit-item/<int:item_id>/")
def edit_item_page(item_id):
    return send_from_directory(FRONTEND_DIR, "edit_item.html")


@app.route("/profile")
@app.route("/profile/")
def profile_page():
    return send_from_directory(FRONTEND_DIR, "profile.html")


@app.before_request
def ensure_scheduler_running():
    # Ensures scheduler starts even when app is launched with `flask run`.
    if not scheduler.running:
        start_scheduler()


def start_scheduler():
    if scheduler.running:
        return

    def scheduled_job():
        try:
            with app.app_context():
                print("\n[info] Running scheduled expiry notification job...")
                result = run_daily_expiry_job()
                print(f"[ok] Job completed: {result}")
        except Exception as error:
            print(f"[error] Scheduler error: {error}")

    scheduler.add_job(
        func=scheduled_job,
        trigger="interval",
        days=1,
        id="daily_expiry_job",
        replace_existing=True,
    )
    scheduler.start()
    print("[ok] Scheduler started - Will check expiry items every 1 day")


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
        start_scheduler()
    app.run(debug=True)
