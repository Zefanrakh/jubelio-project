import "fastify";
import pgPromise from "pg-promise";

declare module "fastify" {
  interface FastifyInstance {
    db: pgPromise.IDatabase<any>;
  }
}
