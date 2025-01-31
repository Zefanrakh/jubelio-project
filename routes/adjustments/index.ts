import { FastifyInstance } from "fastify";

/**
 * Defines routes for managing adjustment transactions.
 *
 * @param {FastifyInstance} fastify - The Fastify instance to register the routes.
 */
export default async function adjustmentRoutes(fastify: FastifyInstance) {
  const db = fastify.db;
  /**
   * Get a paginated list of adjustment transactions.
   *
   * @route GET /
   * @queryParam {number} [page=1] - The page number (default is 1).
   * @queryParam {number} [limit=10] - The number of items per page (default is 10).
   * @returns {Object} 200 - A paginated list of adjustments.
   * @returns {Object} 500 - Internal server error.
   */
  fastify.get("/", async (request, reply) => {
    const { page = 1, limit = 10 } = request.query as {
      page: number;
      limit: number;
    };
    const offset = (page - 1) * limit;

    try {
      const totalItems = await db.one(
        `SELECT COUNT(*) FROM adjustments 
         WHERE deleted_at IS NULL`,
        [],
        (row) => parseInt(row.count, 10)
      );

      const adjustments = await db.any(
        `SELECT adj.id as id, prod.id as product_id, adj.sku as sku, qty, (price * qty)::float AS amount FROM adjustments adj 
         JOIN products prod ON adj.sku = prod.sku WHERE adj.deleted_at IS NULL
         ORDER BY adj.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const totalPages = Math.ceil(totalItems / limit);
      reply.send({ adjustments, totalItems, totalPages, currentPage: page });
    } catch (error: any) {
      fastify.log.error(error);
      reply.status(500).send({
        error: "Failed to fetch adjustments.",
        details: error.message,
      });
    }
  });

  /**
   * Get the details of a specific adjustment by its ID.
   *
   * @route GET /:id
   * @param {string} id - The ID of the adjustment.
   * @returns {Object} 200 - The details of the adjustment.
   * @returns {Object} 404 - Adjustment not found.
   * @returns {Object} 500 - Internal server error.
   */
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const adjustment = await db.oneOrNone(
        `SELECT adj.id as id, prod.id as product_id, adj.sku as sku, qty, (price * qty)::float AS amount, adj.created_at as created_at FROM adjustments adj
         JOIN products prod ON adj.sku = prod.sku
         WHERE adj.id = $1 AND adj.deleted_at IS NULL`,
        [id]
      );

      if (!adjustment) {
        return reply.status(404).send({ error: "Adjustment not found." });
      }

      reply.send(adjustment);
    } catch (error: any) {
      fastify.log.error(error);
      reply.status(500).send({
        error: "Failed to fetch adjustment.",
        details: error.message,
      });
    }
  });

  /**
   * Create or update an adjustment transaction.
   *
   * @route POST /
   * @bodyParam {number} [id] - The ID of the adjustment (for update only).
   * @bodyParam {string} sku - The SKU of the product.
   * @bodyParam {number} qty - The quantity of the adjustment.
   * @returns {Object} 200 - Adjustment created or updated successfully.
   * @returns {Object} 400 - Invalid adjustment or stock issue.
   * @returns {Object} 404 - Adjustment or product not found.
   * @returns {Object} 500 - Internal server error.
   */
  fastify.post("/", async (request, reply) => {
    const fields = request.body as {
      id?: number;
      sku: string;
      qty: number;
    };

    const { id, qty } = fields;
    let sku = fields.sku;
    try {
      let product = null;
      let adjustment = null;
      let diff = qty;

      // Check if adjustment exists, and asign adjustment sku to variable sku
      if (id) {
        adjustment = await db.oneOrNone(
          `SELECT sku, qty FROM adjustments WHERE id = $1`,
          [id]
        );

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
      product = await db.oneOrNone(
        `SELECT stock FROM products WHERE sku = $1`,
        [sku]
      );

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
        await db.none(`UPDATE adjustments SET qty = $1 WHERE id = $2`, [
          qty,
          id,
        ]);
        reply.send({ message: "Adjustment updated successfully." });
      } else {
        // Create adjustment
        await db.none(`INSERT INTO adjustments (sku, qty) VALUES ($1, $2)`, [
          sku,
          qty,
        ]);
      }

      // Update product stock
      await db.none(`UPDATE products SET stock = stock + $1 WHERE sku = $2`, [
        diff,
        sku,
      ]);

      reply.send({ message: "Adjustment created successfully." });
    } catch (error: any) {
      fastify.log.error(error);
      reply.status(500).send({
        error: "Failed to save adjustment.",
        details: error.message,
      });
    }
  });

  /**
   * Soft delete an adjustment by ID.
   *
   * @route DELETE /:id
   * @param {string} id - The ID of the adjustment.
   * @returns {Object} 200 - Adjustment soft-deleted successfully.
   * @returns {Object} 404 - Adjustment not found.
   * @returns {Object} 500 - Internal server error.
   */
  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const adjustment = await db.oneOrNone(
        `SELECT adj.id as id, prod.id as product_id, adj.sku as sku, qty, (price * qty)::float AS amount FROM adjustments adj
         JOIN products prod ON adj.sku = prod.sku
         WHERE adj.id = $1 AND adj.deleted_at IS NULL`,
        [id]
      );

      if (!adjustment) {
        return reply.status(404).send({ error: "Adjustment not found." });
      }

      await db.none(`UPDATE adjustments SET deleted_at = NOW() WHERE id = $1`, [
        id,
      ]);

      // Adjust impacted product stock
      const qty = adjustment.qty;
      const sku = adjustment.sku;

      await db.none(`UPDATE products SET stock = stock + $1 WHERE sku = $2`, [
        -qty,
        sku,
      ]);

      reply.send({
        message: "Adjustment soft-deleted successfully.",
      });
    } catch (error: any) {
      fastify.log.error(error);
      reply.status(500).send({
        error: "Failed to soft delete adjustment.",
        details: error.message,
      });
    }
  });
}
