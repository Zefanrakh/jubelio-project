"use strict";
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
const autoload_1 = __importDefault(require("@fastify/autoload"));
const fastify_1 = __importDefault(require("fastify"));
const path_1 = require("path");
const cors_1 = __importDefault(require("@fastify/cors"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const fastify = (0, fastify_1.default)({ logger: true });
fastify.register(cors_1.default, {
    origin: (origin, cb) => {
        var _a;
        const allowedOrigins = ((_a = process.env.ALLOWED_ORIGINS) === null || _a === void 0 ? void 0 : _a.split(",")) || [];
        if (!origin || allowedOrigins.includes(origin)) {
            cb(null, true);
            return;
        }
        cb(new Error("Not allowed by CORS"), origin);
    },
    credentials: true,
});
// Autoload plugins and routes
fastify.register(autoload_1.default, {
    dir: (0, path_1.join)(__dirname, "plugins"),
    options: {},
});
fastify.register(autoload_1.default, {
    dir: (0, path_1.join)(__dirname, "routes"),
    options: {},
});
const start = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield fastify.listen({ port: 5000 });
        console.log("Server running on port 5000");
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
});
start();
