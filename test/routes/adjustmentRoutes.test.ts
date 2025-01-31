import fastify, { FastifyInstance } from "fastify";
import { IMemoryDb, newDb } from "pg-mem";
import adjustmentRoutes from "../../routes/adjustments";

describe("Adjustment Routes", () => {
  let app: FastifyInstance;
  let db: ReturnType<IMemoryDb["adapters"]["createPgPromise"]>;

  beforeAll(async () => {
    app = fastify();

    const memDb = newDb();
    db = memDb.adapters.createPgPromise();
    app.decorate("db", db);

    await db.none(`
      CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        sku VARCHAR(255) UNIQUE NOT NULL,
        image TEXT,
        price NUMERIC(10, 2) NOT NULL,
        description TEXT,
        stock INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP DEFAULT NULL
      );

      CREATE TABLE adjustments (
        id SERIAL PRIMARY KEY,
        qty INTEGER NOT NULL,
        sku VARCHAR(255) NOT NULL CHECK (qty >= 1),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP DEFAULT NULL
      );
    `);

    app.register(adjustmentRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  test("GET /adjustments - Fetch list of adjustments", async () => {
    await db.none(
      `INSERT INTO products (title, sku, price, stock) VALUES ('Test Product', 'SKU001', 10.0, 100)`
    );
    await db.none(`INSERT INTO adjustments (sku, qty) VALUES ('SKU001', 5)`);

    const response = await app.inject({
      method: "GET",
      url: "/?page=1&limit=10",
    });

    console.log({ response });

    const payload = JSON.parse(response.payload);
    expect(response.statusCode).toBe(200);
    expect(payload.adjustments).toHaveLength(1);
    expect(payload.adjustments[0].sku).toBe("SKU001");
    expect(payload.totalItems).toBe(1);
  });

  test("POST /adjustments - Create a new adjustment", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/",
      payload: {
        sku: "SKU001",
        qty: 10,
      },
    });

    const payload = JSON.parse(response.payload);
    expect(response.statusCode).toBe(200);
    expect(payload.message).toBe("Adjustment created successfully.");
  });

  test("POST /adjustments - Update an existing adjustment", async () => {
    await db.none(`INSERT INTO adjustments (sku, qty) VALUES ('SKU001', 5)`);

    const adjustment = await db.one(
      `SELECT id FROM adjustments WHERE sku = 'SKU001' LIMIT 1`
    );

    const response = await app.inject({
      method: "POST",
      url: "/",
      payload: {
        id: adjustment.id,
        sku: "SKU001",
        qty: 15,
      },
    });

    const payload = JSON.parse(response.payload);
    expect(response.statusCode).toBe(200);
    expect(payload.message).toBe("Adjustment updated successfully.");
  });

  test("DELETE /adjustments/:id - Soft delete an adjustment", async () => {
    await db.none(`INSERT INTO adjustments (sku, qty) VALUES ('SKU001', 5)`);

    const adjustment = await db.one(
      `SELECT id FROM adjustments WHERE sku = 'SKU001' LIMIT 1`
    );

    const response = await app.inject({
      method: "DELETE",
      url: `/${adjustment.id}`,
    });

    const payload = JSON.parse(response.payload);
    expect(response.statusCode).toBe(200);
    expect(payload.message).toBe("Adjustment soft-deleted successfully.");

    // Check database
    const deletedAdjustment = await db.oneOrNone(
      `SELECT * FROM adjustments WHERE id = $1`,
      [adjustment.id]
    );
    expect(deletedAdjustment.deleted_at).not.toBeNull();
  });

  test("GET /adjustments/:id - Fetch adjustment detail", async () => {
    await db.none(`INSERT INTO adjustments (sku, qty) VALUES ('SKU001', 5)`);

    const adjustment = await db.one(
      `SELECT id FROM adjustments WHERE sku = 'SKU001' LIMIT 1`
    );

    const response = await app.inject({
      method: "GET",
      url: `/${adjustment.id}`,
    });

    const payload = JSON.parse(response.payload);
    expect(response.statusCode).toBe(200);
    expect(payload.sku).toBe("SKU001");
    expect(payload.qty).toBe(5);
  });
});
