from app import app
from models import User, Notification, Item

with app.app_context():
    print('users:')
    for user in User.query.order_by(User.id).all():
        print(f"  {user.id}: {user.name} <{user.email}> status: {user.is_active if hasattr(user,'is_active') else 'n/a'}")
    user = User.query.filter(User.name.ilike('%siya%')).first()
    if not user:
        user = User.query.filter(User.email.ilike('%siya%')).first()
    if not user:
        print('no Siya user found')
    else:
        print('Siya ID', user.id, 'email', user.email)
        items = Item.query.filter_by(user_id=user.id).all()
        print('  items', len(items))
        for item in items:
            print('    ', item.name, item.expiry_date, item.quantity, item.price, item.currency)
        notifs = Notification.query.filter_by(user_id=user.id).order_by(Notification.created_at.desc()).all()
        print('  notifications', len(notifs))
        for n in notifs[:5]:
            print('    ', n.id, n.status, 'is_consumed', n.is_consumed, 'message', n.message)
