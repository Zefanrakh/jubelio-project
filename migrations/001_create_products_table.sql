-- Up
CREATE TABLE
    products (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        sku VARCHAR(255) UNIQUE NOT NULL,
        image TEXT NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        description TEXT,
        stock INTEGER DEFAULT 0,
        is_synced BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Down
DROP TABLE IF EXISTS products;