import fastify, { FastifyInstance } from "fastify";
import { IMemoryDb, newDb } from "pg-mem";
import productRoutes from "../../routes/products";

describe("Product Routes", () => {
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
        sku VARCHAR(255) NOT NULL,
        qty INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP DEFAULT NULL
      );
    `);

    app.register(productRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  test("GET / - Fetch list of products", async () => {
    await db.none(
      `INSERT INTO products (title, sku, price, stock) VALUES ('Product 1', 'SKU001', 100.0, 10)`
    );
    await db.none(
      `INSERT INTO products (title, sku, price, stock) VALUES ('Product 2', 'SKU002', 200.0, 20)`
    );

    const response = await app.inject({
      method: "GET",
      url: "/?page=1&limit=10",
    });

    const payload = JSON.parse(response.payload);
    expect(response.statusCode).toBe(200);
    expect(payload.products).toHaveLength(2);
    expect(payload.totalItems).toBe(2);
  });

  test("GET /:id - Fetch product detail", async () => {
    const product = await db.one(
      `INSERT INTO products (title, sku, price, stock) VALUES ('Product 3', 'SKU003', 300.0, 30) RETURNING id`
    );

    const response = await app.inject({
      method: "GET",
      url: `/${product.id}`,
    });

    const payload = JSON.parse(response.payload);
    expect(response.statusCode).toBe(200);
    expect(payload.sku).toBe("SKU003");
    expect(payload.title).toBe("Product 3");
  });

  test("POST / - Create a new product", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/",
      payload: {
        title: "Product 4",
        sku: "SKU004",
        price: 400.0,
        stock: 40,
      },
    });

    const payload = JSON.parse(response.payload);
    expect(response.statusCode).toBe(200);
    expect(payload.message).toBe("Product created successfully.");
  });

  test("POST / - Update an existing product", async () => {
    const product = await db.one(
      `INSERT INTO products (title, sku, price, stock) VALUES ('Product 5', 'SKU005', 500.0, 50) RETURNING id`
    );

    const response = await app.inject({
      method: "POST",
      url: "/",
      payload: {
        id: product.id,
        title: "Updated Product 5",
        price: 550.0,
      },
    });

    const payload = JSON.parse(response.payload);
    expect(response.statusCode).toBe(200);
    expect(payload.message).toBe("Product updated successfully.");
  });

  test("DELETE /:id - Soft delete a product", async () => {
    const product = await db.one(
      `INSERT INTO products (title, sku, price, stock) VALUES ('Product 6', 'SKU006', 600.0, 60) RETURNING id`
    );

    const response = await app.inject({
      method: "DELETE",
      url: `/${product.id}`,
    });

    const payload = JSON.parse(response.payload);
    expect(response.statusCode).toBe(200);
    expect(payload.message).toBe(
      "Product and related adjustments soft-deleted successfully."
    );

    const deletedProduct = await db.oneOrNone(
      `SELECT * FROM products WHERE id = $1`,
      [product.id]
    );
    expect(deletedProduct.deleted_at).not.toBeNull();
  });
});
