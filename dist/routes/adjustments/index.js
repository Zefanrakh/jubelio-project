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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = productRoutes;
function productRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function* () {
        const db = fastify.db;
        // Get List of Adjustment Transactions
        fastify.get("/", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const { page = 1, limit = 10 } = request.query;
            const offset = (page - 1) * limit;
            try {
                const adjustments = yield db.any(`SELECT adj.id as id, prod.id as product_id, adj.sku as sku, qty, (price * qty)::float AS amount FROM adjustments adj 
         JOIN products prod ON adj.sku = prod.sku WHERE adj.deleted_at IS NULL
         LIMIT $1 OFFSET $2`, [limit, offset]);
                reply.send(adjustments);
            }
            catch (error) {
                fastify.log.error(error);
                reply.status(500).send({
                    error: "Failed to fetch adjustments.",
                    details: error.message,
                });
            }
        }));
        // Get Detail of an Adjustment
        fastify.get("/:id", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const { id } = request.params;
            try {
                const adjustment = yield db.oneOrNone(`SELECT adj.id as id, prod.id as product_id, adj.sku as sku, qty, (price * qty)::float AS amount FROM adjustments adj
         JOIN products prod ON adj.sku = prod.sku
         WHERE adj.id = $1 AND adj.deleted_at IS NULL`, [id]);
                if (!adjustment) {
                    return reply.status(404).send({ error: "Adjustment not found." });
                }
                reply.send(adjustment);
            }
            catch (error) {
                fastify.log.error(error);
                reply.status(500).send({
                    error: "Failed to fetch adjustment.",
                    details: error.message,
                });
            }
        }));
        // Create or Update Adjustment Transaction
        fastify.post("/", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const fields = request.body;
            const { id, qty } = fields;
            let sku = fields.sku;
            try {
                let product = null;
                let adjustment = null;
                let diff = qty;
                // Check if adjustment exists, and asign adjustment sku to variable sku
                if (id) {
                    adjustment = yield db.oneOrNone(`SELECT sku, qty FROM adjustments WHERE id = $1`, [id]);
                    if (!adjustment) {
                        return reply.status(404).send({
                            error: "Adjustment not found.",
                            details: `No adjustment found with id: ${id}`,
                        });
                    }
                    sku = adjustment.sku;
                    diff = qty - adjustment.qty;
                }
                // Check if product exists
                product = yield db.oneOrNone(`SELECT stock FROM products WHERE sku = $1`, [sku]);
                if (!product) {
                    return reply.status(404).send({
                        error: "Product not found.",
                        details: `No product found with sku: ${sku}`,
                    });
                }
                if (product.stock + diff < 0) {
                    return reply.status(400).send({
                        error: "Invalid adjustment.",
                        details: "Stock cannot be negative.",
                    });
                }
                if (id) {
                    // Update adjustment
                    yield db.none(`UPDATE adjustments SET qty = $1 WHERE id = $2`, [
                        qty,
                        id,
                    ]);
                    reply.send({ message: "Adjustment updated successfully." });
                }
                else {
                    // Create adjustment
                    yield db.none(`INSERT INTO adjustments (sku, qty) VALUES ($1, $2)`, [
                        sku,
                        qty,
                    ]);
                }
                // Update product stock
                yield db.none(`UPDATE products SET stock = stock + $1 WHERE sku = $2`, [
                    diff,
                    sku,
                ]);
                reply.send({ message: "Adjustment created successfully." });
            }
            catch (error) {
                fastify.log.error(error);
                reply.status(500).send({
                    error: "Failed to save adjustment.",
                    details: error.message,
                });
            }
        }));
        // Delete an Adjusment
        fastify.delete("/:id", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const { id } = request.params;
            try {
                yield db.none(`UPDATE adjustments SET deleted_at = NOW() WHERE id = $1`, [
                    id,
                ]);
                reply.send({
                    message: "Adjustment soft-deleted successfully.",
                });
            }
            catch (error) {
                fastify.log.error(error);
                reply.status(500).send({
                    error: "Failed to soft delete adjustment.",
                    details: error.message,
                });
            }
        }));
    });
}
