"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const fastify = (0, fastify_1.default)();
const MIGRATIONS_TABLE = "migrations";
fastify.register(Promise.resolve().then(() => __importStar(require("./plugins/database"))));
const runMigrations = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`[${new Date().toISOString()}] Starting migrations...`);
        yield fastify.ready();
        const db = fastify.db;
        yield db.none(`
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
            const alreadyRun = yield db.oneOrNone(`SELECT name FROM ${MIGRATIONS_TABLE} WHERE name = $1`, [file]);
            if (alreadyRun) {
                console.log(`Migration ${file} already run. Skipping.`);
                continue;
            }
            const filePath = path_1.default.resolve(__dirname, "migrations", file);
            let sql = (0, fs_1.readFileSync)(filePath, "utf8");
            if (!sql || sql.trim().length === 0) {
                console.error(`No valid rollback script found for ${file}. Ensure the file contains a valid -- Down: section.`);
                process.exit(1);
            }
            sql = sql.split("-- Down")[0];
            console.log(`Running migration: ${file}`);
            try {
                yield db.none(sql);
            }
            catch (dbError) {
                console.error(`Failed to execute SQL in migration ${file}:`, dbError);
                throw dbError;
            }
            yield db.none(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`, [
                file,
            ]);
        }
        console.log("Migrations completed successfully.");
        process.exit(0);
    }
    catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
    finally {
        try {
            yield fastify.close();
        }
        catch (closeError) {
            console.error("Failed to close Fastify instance:", closeError);
        }
    }
});
const rollbackMigration = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`[${new Date().toISOString()}] Starting migrations...`);
        yield fastify.ready();
        const db = fastify.db;
        const lastMigration = yield db.oneOrNone(`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY run_on DESC LIMIT 1`);
        if (!lastMigration) {
            console.log("No migrations to rollback.");
            return;
        }
        const filePath = path_1.default.resolve(__dirname, "migrations", lastMigration.name);
        const sql = (0, fs_1.readFileSync)(filePath, "utf8").split("-- Down")[1];
        if (!sql) {
            console.error(`No rollback script found for ${lastMigration.name}`);
            process.exit(1);
        }
        console.log(`Rolling back migration: ${lastMigration.name}`);
        try {
            yield db.none(sql);
        }
        catch (dbError) {
            console.error(`Failed to execute SQL in migration ${lastMigration.name}:`, dbError);
            throw dbError;
        }
        yield db.none(`DELETE FROM ${MIGRATIONS_TABLE} WHERE name = $1`, [
            lastMigration.name,
        ]);
        console.log("Rollback completed successfully.");
        process.exit(0);
    }
    catch (error) {
        console.error("Rollback failed:", error);
        process.exit(1);
    }
    finally {
        try {
            yield fastify.close();
        }
        catch (closeError) {
            console.error("Failed to close Fastify instance:", closeError);
        }
    }
});
const action = process.argv[2];
if (!["migrate", "rollback"].includes(action)) {
    console.log('Invalid action. Please specify "migrate" or "rollback".');
    process.exit(1);
}
if (action === "migrate") {
    runMigrations();
}
else if (action === "rollback") {
    rollbackMigration();
}
else {
    console.log('Please specify "migrate" or "rollback"');
    process.exit(1);
}
