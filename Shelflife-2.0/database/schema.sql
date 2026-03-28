CREATE DATABASE IF NOT EXISTS shelflife;
USE shelflife;
CREATE TABLE IF NOT EXISTS shelflife_users (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS shelflife_items (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    expiry_date DATE NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    is_consumed BOOLEAN NOT NULL DEFAULT FALSE,
    consumed_at TIMESTAMP NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES shelflife_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shelflife_notifications (
    id INT NOT NULL AUTO_INCREMENT,
    message VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    is_read BOOLEAN DEFAULT FALSE,
    is_consumed BOOLEAN DEFAULT FALSE,
    consumed_at TIMESTAMP NULL,
    read_at TIMESTAMP NULL,
    last_emailed_at TIMESTAMP NULL,
    wasted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INT NOT NULL,
    item_id INT NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES shelflife_users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES shelflife_items(id) ON DELETE CASCADE
);

CREATE INDEX idx_shelflife_users_email ON shelflife_users(email);
CREATE INDEX idx_shelflife_items_user_id ON shelflife_items(user_id);
CREATE INDEX idx_shelflife_items_expiry ON shelflife_items(expiry_date);
CREATE INDEX idx_shelflife_notif_user ON shelflife_notifications(user_id);
CREATE INDEX idx_shelflife_notif_item ON shelflife_notifications(item_id);
