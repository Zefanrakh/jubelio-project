-- Up
CREATE TABLE
    migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        run_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Down
DROP TABLE IF EXISTS migrations;