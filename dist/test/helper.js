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
exports.config = config;
exports.build = build;
const path_1 = __importDefault(require("path"));
// This file contains code that we reuse
// between our tests.
const helper_1 = require("fastify-cli/helper");
const AppPath = path_1.default.join(__dirname, "..", "app.js");
// Fill in this config with all the configurations
// needed for testing the application
function config() {
    return {
        skipOverride: true, // Register our application with fastify-plugin
    };
}
// automatically build and tear down our instance
function build(t) {
    return __awaiter(this, void 0, void 0, function* () {
        // you can set all the options supported by the fastify CLI command
        const argv = [AppPath];
        // fastify-plugin ensures that all decorators
        // are exposed for testing purposes, this is
        // different from the production setup
        const app = yield (0, helper_1.build)(argv, config());
        // close the app after we are done
        t.after(() => app.close());
        return app;
    });
}
