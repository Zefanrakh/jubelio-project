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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = productRoutes;
function productRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function* () {
        const db = fastify.db;
        // Get List of Products (with Initial Sync from Dummy JSON if Empty)
        fastify.get("/", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const { page = 1, limit = 10 } = request.query;
            const offset = (page - 1) * limit;
            try {
                // Check if products table is empty
                const productCount = yield db.oneOrNone(`SELECT COUNT(*) FROM products`);
                if (parseInt((productCount === null || productCount === void 0 ? void 0 : productCount.count) || "0", 10) === 0) {
                    // Sync from Dummy JSON if empty
                    const dummyApiUrl = "https://dummyjson.com/products";
                    const response = yield fetch(dummyApiUrl);
                    const { products } = yield response.json();
                    for (const product of products) {
                        yield db.none(`INSERT INTO products (title, sku, image, price, description) 
             VALUES ($1, $2, $3, $4, $5) 
             ON CONFLICT (sku) DO NOTHING`, [
                            product.title,
                            product.sku,
                            product.image,
                            product.price,
                            product.description,
                        ]);
                    }
                }
                const products = yield db.any(`SELECT id, title, sku, image, price::float AS price, stock FROM products WHERE deleted_at IS NULL LIMIT $1 OFFSET $2`, [limit, offset]);
                reply.send(products);
            }
            catch (error) {
                fastify.log.error(error);
                reply.status(500).send({
                    error: "Failed to fetch products.",
                    details: error.message,
                });
            }
        }));
        // Get Detail of a Product by ID
        fastify.get("/:id", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const { id } = request.params;
            try {
                const product = yield db.oneOrNone(`SELECT id, title, sku, image, price::float AS price, stock, description FROM products WHERE id = $1 AND deleted_at IS NULL`, [id]);
                if (!product) {
                    return reply.status(404).send({ error: "Product not found." });
                }
                reply.send(product);
            }
            catch (error) {
                fastify.log.error(error);
                reply.status(500).send({
                    error: "Failed to fetch product.",
                    details: error.message,
                });
            }
        }));
        // Create or Update a Product
        fastify.post("/", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const _a = request.body, { id } = _a, fields = __rest(_a, ["id"]);
            try {
                if (id) {
                    // Check if SKU is being updated and validate uniqueness
                    if (fields.sku) {
                        const existingProduct = yield db.oneOrNone(`SELECT id FROM products WHERE sku = $1 AND id <> $2`, [fields.sku, id]);
                        if (existingProduct) {
                            return reply.status(400).send({
                                error: "SKU already exists.",
                                details: `A product with SKU: ${fields.sku} already exists.`,
                            });
                        }
                    }
                    // Update product - only update fields that are provided
                    const keys = Object.keys(fields);
                    const values = Object.values(fields);
                    const product = yield db.oneOrNone(`SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL`, [id]);
                    if (!product) {
                        return reply.status(404).send({ error: "Product not found." });
                    }
                    const currentSku = product.sku;
                    const setClause = keys
                        .map((key, index) => `${key} = $${index + 1}`)
                        .join(", ");
                    yield db.none(`UPDATE products SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, id]);
                    // Update all adjustments that refer to this sku
                    if (fields["sku"]) {
                        yield db.none(`UPDATE adjustments SET sku = $1 WHERE sku = '${currentSku}'`, [fields.sku]);
                    }
                    reply.send({ message: "Product updated successfully." });
                }
                else {
                    // Create product
                    const keys = Object.keys(fields);
                    const values = Object.values(fields);
                    const columns = keys.join(", ");
                    const placeholders = keys.map((_, index) => `$${index + 1}`).join(", ");
                    yield db.none(`INSERT INTO products (${columns}) VALUES (${placeholders}) ON CONFLICT (sku) DO NOTHING`, values);
                    reply.send({ message: "Product created successfully." });
                }
            }
            catch (error) {
                fastify.log.error(error);
                reply.status(500).send({
                    error: "Failed to upsert product.",
                    details: error.message,
                });
            }
        }));
        // Delete a Product
        fastify.delete("/:id", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const { id } = request.params;
            try {
                yield db.none(`UPDATE products SET deleted_at = NOW() WHERE id = $1`, [
                    id,
                ]);
                // Soft delete related adjustments
                yield db.none(`UPDATE adjustments SET deleted_at = NOW() WHERE sku = (SELECT sku FROM products WHERE id = $1)`, [id]);
                reply.send({
                    message: "Product and related adjustments soft-deleted successfully.",
                });
            }
            catch (error) {
                fastify.log.error(error);
                reply.status(500).send({
                    error: "Failed to soft delete product.",
                    details: error.message,
                });
            }
        }));
    });
}
