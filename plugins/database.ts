import fp from "fastify-plugin";
import pgPromise from "pg-promise";
import { config } from "dotenv";

config();

const pgp = pgPromise();

const db = pgp({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

export default fp(async (fastify) => {
  fastify.decorate("db", db);
});
