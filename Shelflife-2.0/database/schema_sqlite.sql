CREATE TABLE IF NOT EXISTS shelflife_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shelflife_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    expiry_date DATE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price REAL NOT NULL DEFAULT 0.0,
    currency TEXT NOT NULL DEFAULT 'USD',
    is_consumed BOOLEAN NOT NULL DEFAULT 0,
    consumed_at DATETIME NULL,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES shelflife_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shelflife_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    is_read BOOLEAN DEFAULT 0,
    is_consumed BOOLEAN DEFAULT 0,
    consumed_at DATETIME NULL,
    read_at DATETIME NULL,
    last_emailed_at DATETIME NULL,
    wasted_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES shelflife_users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES shelflife_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shelflife_users_email ON shelflife_users(email);
CREATE INDEX IF NOT EXISTS idx_shelflife_items_user_id ON shelflife_items(user_id);
CREATE INDEX IF NOT EXISTS idx_shelflife_items_expiry ON shelflife_items(expiry_date);
CREATE INDEX IF NOT EXISTS idx_shelflife_notif_user ON shelflife_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_shelflife_notif_item ON shelflife_notifications(item_id);
