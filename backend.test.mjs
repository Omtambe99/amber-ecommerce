import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createApp } = require("./backend/app");
let app;

describe("e-commerce API", () => {
  beforeEach(() => {
    app = createApp();
  });

  it("provides the health endpoint used by Render", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("allows the browser's PUT preflight with an idempotency header", async () => {
    const response = await request(app).options("/api/orders")
      .set("Origin", "https://amber-demo.vercel.app")
      .set("Access-Control-Request-Method", "PUT")
      .set("Access-Control-Request-Headers", "content-type,idempotency-key");
    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-methods"]).toContain("PUT");
    expect(response.headers["access-control-allow-headers"]).toContain("idempotency-key");
  });

  it("uses the configured Vercel origin in CORS responses", async () => {
    vi.stubEnv("CLIENT_ORIGIN", "https://amber-demo.vercel.app");
    try {
      const configuredApp = createApp();
      const response = await request(configuredApp).get("/api/products")
        .set("Origin", "https://amber-demo.vercel.app");
      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe("https://amber-demo.vercel.app");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("lists products", async () => {
    const response = await request(app).get("/api/products");
    expect(response.status).toBe(200);
    expect(response.body.products).toHaveLength(4);
  });

  it("gets one product", async () => {
    const response = await request(app).get("/api/products/P1001");
    expect(response.status).toBe(200);
    expect(response.body.product.name).toBe("Wireless Headphones");
  });

  it("returns 404 for a missing product", async () => {
    const response = await request(app).get("/api/products/UNKNOWN");
    expect(response.status).toBe(404);
  });

  it("requires an idempotency key", async () => {
    const response = await request(app)
      .post("/api/orders")
      .send({ product_id: "P1001", quantity: 1 });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });

  it("places an order and reduces stock", async () => {
    const response = await request(app)
      .post("/api/orders")
      .set("Idempotency-Key", "order-1")
      .send({ product_id: "P1001", quantity: 3 });
    expect(response.status).toBe(201);
    expect(response.body.order).toMatchObject({
      product_id: "P1001",
      product_name: "Wireless Headphones",
      quantity: 3,
      unit_price: 2999,
      total_amount: 8997,
      status: "PLACED",
    });
    expect(response.header["idempotent-replayed"]).toBe("false");

    const product = await request(app).get("/api/products/P1001");
    expect(product.body.product.quantity).toBe(9);
  });

  it("replays a successful result for the same idempotency key", async () => {
    const first = await request(app)
      .post("/api/orders")
      .set("Idempotency-Key", "retry-1")
      .send({ product_id: "P1002", quantity: 2 });
    const second = await request(app)
      .put("/api/orders")
      .set("Idempotency-Key", "retry-1")
      .send({ product_id: "P1002", quantity: 2 });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.header["idempotent-replayed"]).toBe("true");
    expect(second.body.order.order_id).toBe(first.body.order.order_id);

    const product = await request(app).get("/api/products/P1002");
    expect(product.body.product.quantity).toBe(6);
  });

  it("rejects reuse of an idempotency key with different order details", async () => {
    await request(app)
      .post("/api/orders")
      .set("Idempotency-Key", "conflict-key")
      .send({ product_id: "P1001", quantity: 1 });
    const response = await request(app)
      .post("/api/orders")
      .set("Idempotency-Key", "conflict-key")
      .send({ product_id: "P1001", quantity: 2 });
    expect(response.status).toBe(409);
    expect(response.body.error).toBe("IDEMPOTENCY_KEY_CONFLICT");
  });

  it("rejects quantity above available stock", async () => {
    const response = await request(app)
      .post("/api/orders")
      .set("Idempotency-Key", "stock-key")
      .send({ product_id: "P1003", quantity: 21 });
    expect(response.status).toBe(409);
    expect(response.body.error).toBe("INSUFFICIENT_STOCK");
  });

  it("serializes concurrent orders and rejects purchases beyond available stock", async () => {
    const requests = Array.from({ length: 25 }, (_, index) =>
      request(app)
        .post("/api/orders")
        .set("Idempotency-Key", `concurrent-${index}`)
        .send({ product_id: "P1004", quantity: 1 }),
    );
    const responses = await Promise.all(requests);
    const successful = responses.filter((response) => response.status === 201);

    expect(successful).toHaveLength(15);
    expect(
      responses.filter((response) => response.status === 409),
    ).toHaveLength(10);

    const product = await request(app).get("/api/products/P1004");
    expect(product.body.product.quantity).toBe(0);
    const history = await request(app).get("/api/orders");
    expect(history.body.orders).toHaveLength(15);
  });

  it("validates quantity", async () => {
    const response = await request(app)
      .post("/api/orders")
      .set("Idempotency-Key", "invalid-key")
      .send({ product_id: "P1001", quantity: 0 });
    expect(response.status).toBe(400);
  });

  it.each([-1, 1.5, "2", null, true, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid quantity %s without changing stock",
    async (quantity) => {
      const response = await request(app)
        .put("/api/orders")
        .set("Idempotency-Key", "invalid-quantity")
        .send({ product_id: "P1001", quantity });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe("INVALID_ORDER");
      const product = await request(app).get("/api/products/P1001");
      expect(product.body.product.quantity).toBe(12);
    },
  );

  it.each([null, 123, {}, [], "", " "])(
    "rejects invalid product ID %j",
    async (productId) => {
      const response = await request(app)
        .put("/api/orders")
        .set("Idempotency-Key", "invalid-product")
        .send({ product_id: productId, quantity: 1 });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe("INVALID_ORDER");
    },
  );

  it("rejects missing order fields", async () => {
    const response = await request(app)
      .put("/api/orders")
      .set("Idempotency-Key", "missing-fields")
      .send({});
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("INVALID_ORDER");
  });

  it("creates an order using PUT and ignores client-supplied prices", async () => {
    const response = await request(app)
      .put("/api/orders")
      .set("Idempotency-Key", "put-order")
      .send({
        product_id: "P1003",
        quantity: 2,
        unit_price: 1,
        total_amount: 2,
      });
    expect(response.status).toBe(201);
    expect(response.body.order.total_amount).toBe(3998);
    const product = await request(app).get("/api/products/P1003");
    expect(product.body.product.quantity).toBe(18);
  });

  it("returns 404 when ordering a missing product", async () => {
    const response = await request(app)
      .put("/api/orders")
      .set("Idempotency-Key", "not-found")
      .send({ product_id: "UNKNOWN", quantity: 1 });
    expect(response.status).toBe(404);
    expect(response.body.error).toBe("PRODUCT_NOT_FOUND");
    const history = await request(app).get("/api/orders");
    expect(history.body.orders).toEqual([]);
  });

  it("does not create an order or reduce stock for an insufficient-stock request", async () => {
    await request(app)
      .put("/api/orders")
      .set("Idempotency-Key", "too-many")
      .send({ product_id: "P1002", quantity: 9 });
    const product = await request(app).get("/api/products/P1002");
    const history = await request(app).get("/api/orders");
    expect(product.body.product.quantity).toBe(8);
    expect(history.body.orders).toHaveLength(0);
  });

  it("allows the exact remaining stock, then rejects another purchase", async () => {
    const first = await request(app)
      .put("/api/orders")
      .set("Idempotency-Key", "buy-all")
      .send({ product_id: "P1002", quantity: 8 });
    const second = await request(app)
      .put("/api/orders")
      .set("Idempotency-Key", "sold-out")
      .send({ product_id: "P1002", quantity: 1 });
    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(second.body.available_quantity).toBe(0);
  });

  it("handles simultaneous retries as one order and reduces stock only once", async () => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        request(app)
          .put("/api/orders")
          .set("Idempotency-Key", "same-concurrent-key")
          .send({ product_id: "P1001", quantity: 3 }),
      ),
    );
    expect(responses.every((response) => response.status === 201)).toBe(true);
    expect(
      new Set(responses.map((response) => response.body.order.order_id)).size,
    ).toBe(1);
    expect(
      responses.filter(
        (response) => response.header["idempotent-replayed"] === "false",
      ),
    ).toHaveLength(1);
    const product = await request(app).get("/api/products/P1001");
    const history = await request(app).get("/api/orders");
    expect(product.body.product.quantity).toBe(9);
    expect(history.body.orders).toHaveLength(1);
  });

  it("rejects simultaneous conflicting requests that share a key", async () => {
    const responses = await Promise.all(
      [1, 2].map((quantity) =>
        request(app)
          .put("/api/orders")
          .set("Idempotency-Key", "same-key-different-body")
          .send({ product_id: "P1001", quantity }),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    const successful = responses.find((response) => response.status === 201);
    const product = await request(app).get("/api/products/P1001");
    expect(product.body.product.quantity).toBe(
      12 - successful.body.order.quantity,
    );
    expect(
      responses.find((response) => response.status === 409).body.error,
    ).toBe("IDEMPOTENCY_KEY_CONFLICT");
  });

  it("replays an insufficient-stock result without changing it after another order", async () => {
    const first = await request(app)
      .put("/api/orders")
      .set("Idempotency-Key", "failed-stock")
      .send({ product_id: "P1001", quantity: 13 });
    await request(app)
      .put("/api/orders")
      .set("Idempotency-Key", "valid-order")
      .send({ product_id: "P1001", quantity: 2 });
    const replay = await request(app)
      .put("/api/orders")
      .set("Idempotency-Key", "failed-stock")
      .send({ product_id: "P1001", quantity: 13 });
    expect(replay.status).toBe(409);
    expect(replay.body).toEqual(first.body);
    expect(replay.header["idempotent-replayed"]).toBe("true");
  });

  it("continues processing orders after a key conflict", async () => {
    await request(app)
      .put("/api/orders")
      .set("Idempotency-Key", "existing")
      .send({ product_id: "P1001", quantity: 1 });
    await request(app)
      .put("/api/orders")
      .set("Idempotency-Key", "existing")
      .send({ product_id: "P1001", quantity: 2 });
    const response = await request(app)
      .put("/api/orders")
      .set("Idempotency-Key", "next-order")
      .send({ product_id: "P1001", quantity: 1 });
    expect(response.status).toBe(201);
    const product = await request(app).get("/api/products/P1001");
    expect(product.body.product.quantity).toBe(10);
  });

  it("lists and retrieves created orders", async () => {
    const placed = await request(app)
      .put("/api/orders")
      .set("Idempotency-Key", "history")
      .send({ product_id: "P1004", quantity: 2 });
    const history = await request(app).get("/api/orders");
    const detail = await request(app).get(
      `/api/orders/${placed.body.order.order_id}`,
    );
    expect(history.body.orders).toEqual([placed.body.order]);
    expect(detail.body.order).toEqual(placed.body.order);
    expect(detail.status).toBe(200);
  });

  it("returns 404 for a missing order", async () => {
    const response = await request(app).get("/api/orders/UNKNOWN");
    expect(response.status).toBe(404);
    expect(response.body.error).toBe("ORDER_NOT_FOUND");
  });

  it.each([" ", "x".repeat(129), 123, {}])(
    "rejects invalid idempotency key %j",
    async (key) => {
      const response = await request(app)
        .put("/api/orders")
        .send({ product_id: "P1001", quantity: 1, idempotency_key: key });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe("INVALID_IDEMPOTENCY_KEY");
    },
  );

  it("returns a JSON error for malformed JSON", async () => {
    const response = await request(app)
      .put("/api/orders")
      .set("Content-Type", "application/json")
      .send('{"product_id":');
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("INVALID_JSON");
  });

  it("starts with fresh in-memory data in a new app", async () => {
    await request(app)
      .put("/api/orders")
      .set("Idempotency-Key", "old-session")
      .send({ product_id: "P1001", quantity: 4 });
    const freshApp = createApp();
    const product = await request(freshApp).get("/api/products/P1001");
    const history = await request(freshApp).get("/api/orders");
    expect(product.body.product.quantity).toBe(12);
    expect(history.body.orders).toEqual([]);
  });
});
