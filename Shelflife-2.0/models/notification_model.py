from database import db


class Notification(db.Model):
    __tablename__ = "shelflife_notifications"

    id = db.Column(db.Integer, primary_key=True)
    message = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(20), nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    is_consumed = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now(), nullable=False)
    consumed_at = db.Column(db.DateTime, nullable=True)
    read_at = db.Column(db.DateTime, nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('shelflife_users.id'), nullable=False)
    item_id = db.Column(db.Integer, db.ForeignKey('shelflife_items.id'), nullable=False)
