import os
from importlib.util import find_spec

from dotenv import load_dotenv
from sqlalchemy.engine import URL


load_dotenv()


def resolve_database_uri():
    database_url = os.getenv("DATABASE_URL")
    default_sqlite = "sqlite:///pantry.db"

    if database_url:
        if database_url.startswith("mysql+pymysql://") and find_spec("pymysql") is None:
            print("ShelfLife: PyMySQL is not installed, falling back to sqlite:///pantry.db for local startup.")
            return default_sqlite
        return database_url

    db_host = os.getenv("DB_HOST")
    db_port = os.getenv("DB_PORT", "3306")
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_name = os.getenv("DB_NAME")

    if all([db_host, db_user, db_name]):
        if find_spec("pymysql") is None:
            print("ShelfLife: PyMySQL is not installed, falling back to sqlite:///pantry.db for local startup.")
            return default_sqlite

        return URL.create(
            drivername="mysql+pymysql",
            username=db_user,
            password=db_password or "",
            host=db_host,
            port=int(db_port),
            database=db_name,
        ).render_as_string(hide_password=False)

    return default_sqlite


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "default_secret_key")
    SQLALCHEMY_DATABASE_URI = resolve_database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt_secret_key")
    MAIL_SERVER = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.getenv("MAIL_PORT", 587))
    MAIL_USE_TLS = os.getenv("MAIL_USE_TLS", "True").lower() in ["true", "1"]
    MAIL_USERNAME = os.getenv("MAIL_USERNAME")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = os.getenv("MAIL_DEFAULT_SENDER", "noreply@pantry.com")
    MAIL_SENDER_NAME = os.getenv("MAIL_SENDER_NAME", "Shelf Life")
    MAIL_TEST_MODE = os.getenv("MAIL_TEST_MODE", "False").lower() in ["true", "1", "yes"]
    EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "auto").strip().lower()
    SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
    SENDGRID_FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL", MAIL_DEFAULT_SENDER)
    FRONTEND_URL = os.getenv("FRONTEND_URL")
    ADMIN_SECRET = os.getenv("ADMIN_SECRET")
