const express = require("express");
const cors = require("cors");
const path = require("node:path");
const { sampleProducts } = require("./products");

const createApp = () => {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || "*",
      exposedHeaders: ["Idempotent-Replayed"],
    }),
  );
  app.use(express.json({ limit: "10kb" }));
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  // These Maps are our small, in-memory database. Each app has its own data.
  const products = new Map(
    sampleProducts.map((product) => [product.product_id, { ...product }]),
  );

  const orders = new Map();
  const idempotencyRecords = new Map();
  let lockTail = Promise.resolve();
  let nextOrderNumber = 1000;

  // Queue order operations: only one can check and change stock at a time.
  const withLock = (operation) => {
    const result = lockTail.then(operation, operation);
    lockTail = result.catch(() => {}); // A failed operation must not stop the queue.
    return result;
  };

  app.get("/api/products", (_req, res) => {
    res.json({ products: [...products.values()] });
  });

  app.get("/api/products/:productId", (req, res) => {
    const product = products.get(req.params.productId);
    if (!product) {
      return res
        .status(404)
        .json({
          error: "PRODUCT_NOT_FOUND",
          message: "This product was not found.",
        });
    }
    res.json({ product });
  });

  const placeOrder = async (req, res) => {
    const idempotencyKey =
      req.header("Idempotency-Key") ?? req.body?.idempotency_key;
    const { product_id: productId, quantity } = req.body || {};

    if (!idempotencyKey) {
      return res
        .status(400)
        .json({
          error: "IDEMPOTENCY_KEY_REQUIRED",
          message: "An Idempotency-Key is required.",
        });
    }
    if (
      typeof idempotencyKey !== "string" ||
      !idempotencyKey.trim() ||
      idempotencyKey.length > 128
    ) {
      return res
        .status(400)
        .json({
          error: "INVALID_IDEMPOTENCY_KEY",
          message: "Use a non-empty idempotency key of up to 128 characters.",
        });
    }
    if (
      typeof productId !== "string" ||
      !productId.trim() ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1
    ) {
      return res
        .status(400)
        .json({
          error: "INVALID_ORDER",
          message:
            "A product_id and a positive whole-number quantity are required.",
        });
    }

    const fingerprint = JSON.stringify({ product_id: productId, quantity });

    try {
      const outcome = await withLock(() => {
        const existing = idempotencyRecords.get(idempotencyKey);
        if (existing) {
          if (existing.requestFingerprint !== fingerprint) {
            const error = new Error(
              "Idempotency key was reused for a different request",
            );
            error.status = 409;
            error.code = "IDEMPOTENCY_KEY_CONFLICT";
            throw error;
          }
          return {
            status: existing.status,
            body: existing.body,
            replayed: true,
          };
        }

        // Save the result BEFORE releasing the lock, including failed stock checks.
        // Otherwise two simultaneous requests with the same key could both buy stock.
        const remember = (result) => {
          idempotencyRecords.set(idempotencyKey, {
            requestFingerprint: fingerprint,
            status: result.status,
            body: result.body,
          });
          return { ...result, replayed: false };
        };

        const product = products.get(productId);
        if (!product) {
          return remember({
            status: 404,
            body: {
              error: "PRODUCT_NOT_FOUND",
              message: "This product was not found.",
            },
          });
        }
        if (quantity > product.quantity) {
          return remember({
            status: 409,
            body: {
              error: "INSUFFICIENT_STOCK",
              message: product.quantity
                ? `Only ${product.quantity} units are available. Please choose a smaller quantity.`
                : "This product is out of stock.",
              available_quantity: product.quantity,
            },
            replayed: false,
          });
        }

        product.quantity -= quantity;
        const order = {
          order_id: `ORD-${++nextOrderNumber}`,
          product_id: productId,
          product_name: product.name,
          quantity,
          unit_price: product.price,
          total_amount: product.price * quantity,
          status: "PLACED",
          created_at: new Date().toISOString(),
        };
        orders.set(order.order_id, order);
        return remember({ status: 201, body: { order } });
      });

      res.set("Idempotent-Replayed", String(outcome.replayed));
      res.status(outcome.status).json(outcome.body);
    } catch (error) {
      res.status(error.status || 500).json({
        error: error.code || "INTERNAL_ERROR",
        message: error.status
          ? error.message
          : "Something went wrong. Please try again.",
      });
    }
  };

  app.post("/api/orders", placeOrder);
  app.put("/api/orders", placeOrder);

  app.get("/api/orders", (_req, res) => {
    res.json({ orders: [...orders.values()].reverse() });
  });

  app.get("/api/orders/:orderId", (req, res) => {
    const order = orders.get(req.params.orderId);
    if (!order) {
      return res.status(404).json({ error: "ORDER_NOT_FOUND" });
    }
    res.json({ order });
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api", (_req, res) => {
    res
      .status(404)
      .json({
        error: "ROUTE_NOT_FOUND",
        message: "This API route does not exist.",
      });
  });

  // `npm run build` lets Express serve the frontend at localhost:3001, too.
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.use((error, _req, res, _next) => {
    if (error.type === "entity.parse.failed") {
      return res
        .status(400)
        .json({
          error: "INVALID_JSON",
          message: "The request body must be valid JSON.",
        });
    }
    if (error.type === "entity.too.large") {
      return res
        .status(413)
        .json({
          error: "REQUEST_TOO_LARGE",
          message: "The request body is too large.",
        });
    }
    console.error(error);
    res
      .status(500)
      .json({
        error: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      });
  });

  return app;
};

module.exports = { createApp };
