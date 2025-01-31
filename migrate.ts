import Fastify from "fastify";
import { readFileSync } from "fs";
import path from "path";

const fastify = Fastify();
const MIGRATIONS_TABLE = "migrations";

fastify.register(import("./plugins/database"));

const runMigrations = async () => {
  try {
    console.log(`[${new Date().toISOString()}] Starting migrations...`);
    await fastify.ready();

    const db = fastify.db;

    await db.none(`
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        run_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const files = [
      "001_create_products_table.sql",
      "002_remove_is_synced_column.sql",
      "003_add_global_updated_at_trigger.sql",
      "004_make_image_nullable.sql",
      "005_create_adjustments_table.sql",
      "006_remove_adjustments_qty_check_from_adjustments_table.sql",
      "007_add_soft_delete_to_products_and_adjustments_table.sql"
    ];

    for (const file of files) {
      const alreadyRun = await db.oneOrNone(
        `SELECT name FROM ${MIGRATIONS_TABLE} WHERE name = $1`,
        [file]
      );

      if (alreadyRun) {
        console.log(`Migration ${file} already run. Skipping.`);
        continue;
      }

      const filePath = path.resolve(__dirname, "migrations", file);
      let sql = readFileSync(filePath, "utf8");
      if (!sql || sql.trim().length === 0) {
        console.error(
          `No valid rollback script found for ${file}. Ensure the file contains a valid -- Down: section.`
        );
        process.exit(1);
      }

      sql = sql.split("-- Down")[0];
      console.log(`Running migration: ${file}`);
      try {
        await db.none(sql);
      } catch (dbError) {
        console.error(`Failed to execute SQL in migration ${file}:`, dbError);
        throw dbError;
      }

      await db.none(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`, [
        file,
      ]);
    }

    console.log("Migrations completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    try {
      await fastify.close();
    } catch (closeError) {
      console.error("Failed to close Fastify instance:", closeError);
    }
  }
};

const rollbackMigration = async () => {
  try {
    console.log(`[${new Date().toISOString()}] Starting migrations...`);

    await fastify.ready();
    const db = fastify.db;

    const lastMigration = await db.oneOrNone(
      `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY run_on DESC LIMIT 1`
    );

    if (!lastMigration) {
      console.log("No migrations to rollback.");
      return;
    }

    const filePath = path.resolve(__dirname, "migrations", lastMigration.name);
    const sql = readFileSync(filePath, "utf8").split("-- Down")[1];

    if (!sql) {
      console.error(`No rollback script found for ${lastMigration.name}`);
      process.exit(1);
    }

    console.log(`Rolling back migration: ${lastMigration.name}`);
    try {
      await db.none(sql);
    } catch (dbError) {
      console.error(
        `Failed to execute SQL in migration ${lastMigration.name}:`,
        dbError
      );
      throw dbError;
    }

    await db.none(`DELETE FROM ${MIGRATIONS_TABLE} WHERE name = $1`, [
      lastMigration.name,
    ]);

    console.log("Rollback completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Rollback failed:", error);
    process.exit(1);
  } finally {
    try {
      await fastify.close();
    } catch (closeError) {
      console.error("Failed to close Fastify instance:", closeError);
    }
  }
};

const action = process.argv[2];
if (!["migrate", "rollback"].includes(action)) {
  console.log('Invalid action. Please specify "migrate" or "rollback".');
  process.exit(1);
}

if (action === "migrate") {
  runMigrations();
} else if (action === "rollback") {
  rollbackMigration();
} else {
  console.log('Please specify "migrate" or "rollback"');
  process.exit(1);
}
