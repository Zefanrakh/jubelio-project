-- Up
CREATE TABLE
    adjustments (
        id SERIAL PRIMARY KEY,
        sku VARCHAR(255) NOT NULL CHECK (qty >= 1),
        qty INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Down
DROP TABLE IF EXISTS adjustments;