"use strict";

import AutoLoad, { AutoloadPluginOptions } from "@fastify/autoload";
import Fastify from "fastify";
import { join } from "path";
import cors from "@fastify/cors";
import { config } from "dotenv";

// Pass --options via CLI arguments in command to enable these options.
export type AppOptions = {} & Partial<AutoloadPluginOptions>;

config();

const fastify = Fastify({ logger: true });

fastify.register(cors, {
  origin: (origin, cb) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];
    if (!origin || allowedOrigins.includes(origin)) {
      cb(null, true);
      return;
    }
    cb(new Error("Not allowed by CORS"), origin);
  },
  credentials: true,
});

// Autoload plugins and routes
fastify.register(AutoLoad, {
  dir: join(__dirname, "plugins"),
  options: {},
});

fastify.register(AutoLoad, {
  dir: join(__dirname, "routes"),
  options: {},
});

const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port: Number(port), host: "0.0.0.0" });
    console.log(`Server running on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
