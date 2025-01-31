"use strict";

import fastifyPlugin from "fastify-plugin";

/**
 * This plugins adds some utilities to handle http errors
 *
 * @see https://github.com/fastify/fastify-sensible
 */
export default fastifyPlugin(async function (fastify) {
  fastify.register(require("@fastify/sensible"), {
    errorHandler: false,
  });
});
