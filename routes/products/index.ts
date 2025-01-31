import { FastifyInstance } from "fastify";

/**
 * Defines routes for managing products.
 *
 * @param {FastifyInstance} fastify - The Fastify instance to register the routes.
 */
export default async function productRoutes(fastify: FastifyInstance) {
  const db = fastify.db;

  /**
   * Get a list of products with pagination.
   * If the products table is empty, it will sync data from a dummy JSON API.
   *
   * @route GET /
   * @queryParam {number} [page=1] - The page number (default is 1).
   * @queryParam {number} [limit=0] - The number of items per page (default is 0 for no limit).
   * @returns {Object} 200 - List of products with pagination metadata.
   * @returns {Object} 500 - Internal server error.
   */
  fastify.get("/", async (request, reply) => {
    const { page = 1, limit = 0 } = request.query as {
      page: number;
      limit: number;
    };
    const offset = (page - 1) * limit;

    try {
      // Check if products table is empty
      const productCount = await db.oneOrNone(`SELECT COUNT(*) FROM products`);
      let totalItems = 0;
      if (parseInt(productCount?.count || "0", 10) === 0) {
        // Sync from Dummy JSON if empty
        const dummyApiUrl = "https://dummyjson.com/products";
        const response = await fetch(dummyApiUrl);
        const { products } = await response.json();
        totalItems = products.length;
        for (const product of products) {
          await db.none(
            `INSERT INTO products (title, sku, image, price, description) 
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (sku) DO NOTHING`,
            [
              product.title,
              product.sku,
              product.image,
              product.price,
              product.description,
            ]
          );
        }
      } else {
        totalItems = await db.one(
          `SELECT COUNT(*) FROM products 
           WHERE deleted_at IS NULL`,
          [],
          (row) => parseInt(row.count, 10)
        );
      }

      let products = null;
      if (limit) {
        products = await db.any(
          `SELECT id, title, sku, image, price::float AS price, stock, description FROM products WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
          [limit, offset]
        );
      } else {
        products = await db.any(
          `SELECT id, title, sku, image, price::float AS price, stock, description FROM products WHERE deleted_at IS NULL ORDER BY created_at DESC`
        );
      }
      const totalPages = Math.ceil(totalItems / (limit || totalItems));
      reply.send({ products, totalItems, totalPages, currentPage: page });
    } catch (error: any) {
      fastify.log.error(error);
      reply.status(500).send({
        error: "Failed to fetch products.",
        details: error.message,
      });
    }
  });

  /**
   * Get the details of a product by its ID.
   *
   * @route GET /:id
   * @param {string} id - The ID of the product.
   * @returns {Object} 200 - Product details.
   * @returns {Object} 404 - Product not found.
   * @returns {Object} 500 - Internal server error.
   */
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const product = await db.oneOrNone(
        `SELECT id, title, sku, image, price::float AS price, stock, description FROM products WHERE id = $1 AND deleted_at IS NULL`,
        [id]
      );

      if (!product) {
        return reply.status(404).send({ error: "Product not found." });
      }

      reply.send(product);
    } catch (error: any) {
      fastify.log.error(error);
      reply.status(500).send({
        error: "Failed to fetch product.",
        details: error.message,
      });
    }
  });

  /**
   * Create or update a product.
   *
   * @route POST /
   * @bodyParam {number} [id] - The ID of the product (for updates only).
   * @bodyParam {string} title - The title of the product.
   * @bodyParam {string} sku - The SKU of the product.
   * @bodyParam {string} image - The image URL of the product.
   * @bodyParam {number} price - The price of the product.
   * @bodyParam {string} [description] - The description of the product.
   * @returns {Object} 200 - Success message.
   * @returns {Object} 400 - SKU already exists.
   * @returns {Object} 404 - Product not found.
   * @returns {Object} 500 - Internal server error.
   */
  fastify.post("/", async (request, reply) => {
    const { id, ...fields } = request.body as {
      id?: number;
      title: string;
      sku: string;
      image: string;
      price: number;
      description?: string;
    };

    try {
      if (id) {
        // Check if SKU is being updated and validate uniqueness
        if (fields.sku) {
          const existingProduct = await db.oneOrNone(
            `SELECT id FROM products WHERE sku = $1 AND id <> $2`,
            [fields.sku, id]
          );
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

        const product = await db.oneOrNone(
          `SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL`,
          [id]
        );

        if (!product) {
          return reply.status(404).send({ error: "Product not found." });
        }
        const currentSku = product.sku;

        const setClause = keys
          .map((key, index) => `${key} = $${index + 1}`)
          .join(", ");
        await db.none(
          `UPDATE products SET ${setClause} WHERE id = $${keys.length + 1}`,
          [...values, id]
        );

        // Update all adjustments that refer to this sku
        if (fields["sku"]) {
          await db.none(
            `UPDATE adjustments SET sku = $1 WHERE sku = '${currentSku}'`,
            [fields.sku]
          );
        }

        reply.send({ message: "Product updated successfully." });
      } else {
        // Create product
        const keys = Object.keys(fields);
        const values = Object.values(fields);

        const columns = keys.join(", ");
        const placeholders = keys.map((_, index) => `$${index + 1}`).join(", ");

        await db.none(
          `INSERT INTO products (${columns}) VALUES (${placeholders}) ON CONFLICT (sku) DO NOTHING`,
          values
        );

        reply.send({ message: "Product created successfully." });
      }
    } catch (error: any) {
      fastify.log.error(error);
      reply.status(500).send({
        error: "Failed to upsert product.",
        details: error.message,
      });
    }
  });

  /**
   * Soft delete a product by ID and its related adjustments.
   *
   * @route DELETE /:id
   * @param {string} id - The ID of the product.
   * @returns {Object} 200 - Success message.
   * @returns {Object} 500 - Internal server error.
   */
  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await db.none(`UPDATE products SET deleted_at = NOW() WHERE id = $1`, [
        id,
      ]);

      // Soft delete related adjustments
      await db.none(
        `UPDATE adjustments SET deleted_at = NOW() WHERE sku = (SELECT sku FROM products WHERE id = $1)`,
        [id]
      );

      reply.send({
        message: "Product and related adjustments soft-deleted successfully.",
      });
    } catch (error: any) {
      fastify.log.error(error);
      reply.status(500).send({
        error: "Failed to soft delete product.",
        details: error.message,
      });
    }
  });
}
