from flask import current_app
from sqlalchemy import text

from .db import db


def ensure_quantity_column(app=None):
    application = app or current_app
    with application.app_context():
        engine = db.engine
        try:
            with engine.connect() as conn:
                is_sqlite = engine.dialect.name == "sqlite"

                def get_column_names(table_name):
                    if is_sqlite:
                        rows = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
                        return [row[1] for row in rows]
                    rows = conn.execute(text(f"SHOW COLUMNS FROM {table_name}")).fetchall()
                    return [row[0] for row in rows]

                def add_column(table_name, column_definition):
                    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_definition}"))

                item_columns = get_column_names("shelflife_items")
                if "quantity" not in item_columns:
                    definition = "quantity INTEGER NOT NULL DEFAULT 1" if is_sqlite else "quantity INT NOT NULL DEFAULT 1"
                    add_column("shelflife_items", definition)

                if "price" not in item_columns:
                    definition = "price REAL NOT NULL DEFAULT 0.0" if is_sqlite else "price DOUBLE NOT NULL DEFAULT 0"
                    add_column("shelflife_items", definition)

                if "currency" not in item_columns:
                    definition = "currency TEXT NOT NULL DEFAULT 'USD'" if is_sqlite else "currency VARCHAR(10) NOT NULL DEFAULT 'USD'"
                    add_column("shelflife_items", definition)

                if "is_consumed" not in item_columns:
                    definition = "is_consumed BOOLEAN NOT NULL DEFAULT 0" if is_sqlite else "is_consumed TINYINT(1) NOT NULL DEFAULT 0"
                    add_column("shelflife_items", definition)

                if "consumed_at" not in item_columns:
                    add_column("shelflife_items", "consumed_at DATETIME NULL")

                notification_columns = get_column_names("shelflife_notifications")
                if "is_consumed" not in notification_columns:
                    definition = "is_consumed BOOLEAN NOT NULL DEFAULT 0" if is_sqlite else "is_consumed TINYINT(1) NOT NULL DEFAULT 0"
                    add_column("shelflife_notifications", definition)

                if "consumed_at" not in notification_columns:
                    add_column("shelflife_notifications", "consumed_at DATETIME NULL")

                if "read_at" not in notification_columns:
                    add_column("shelflife_notifications", "read_at DATETIME NULL")
        except Exception as error:
            application.logger.info("ensure_quantity_column: %s", error)
