import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStore, fetchProducts, placeOrder } from "./src/store.js";

const product = {
  product_id: "P1001",
  name: "Wireless Headphones",
  price: 2999,
  quantity: 12,
};
const order = {
  order_id: "ORD-1001",
  product_id: "P1001",
  product_name: "Wireless Headphones",
  quantity: 3,
  unit_price: 2999,
  total_amount: 8997,
  status: "PLACED",
};
const response = (data, ok = true) => ({ ok, json: async () => data });

describe("Redux order flow", () => {
  let store;
  let mockFetch;

  beforeEach(() => {
    store = createStore();
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("loads the product dashboard from the REST API", async () => {
    mockFetch.mockResolvedValue(response({ products: [product] }));
    await store.dispatch(fetchProducts());
    expect(mockFetch).toHaveBeenCalledWith("/api/products", undefined);
    expect(store.getState().products.items).toEqual([product]);
  });

  it("keeps the same key when retrying a lost response and reads stock from the server", async () => {
    const keys = [];
    mockFetch.mockImplementation(async (_url, options) => {
      if (options?.method === "PUT") {
        keys.push(options.headers["Idempotency-Key"]);
        if (keys.length === 1)
          throw new TypeError("Network error after server accepted the order");
        return response({ order });
      }
      return response({ products: [{ ...product, quantity: 9 }] });
    });

    const failed = await store.dispatch(
      placeOrder({ productId: "P1001", quantity: 3 }),
    );
    expect(failed.meta.requestStatus).toBe("rejected");
    expect(store.getState().orders.request.key).toBe(keys[0]);

    await store.dispatch(placeOrder({ productId: "P1001", quantity: 3 }));
    await vi.waitFor(() =>
      expect(store.getState().products.status).toBe("succeeded"),
    );
    expect(keys[1]).toBe(keys[0]);
    expect(store.getState().orders.items).toEqual([order]);
    expect(store.getState().products.items[0].quantity).toBe(9);
    expect(store.getState().orders.request).toBeNull();
  });

  it("gives a new order a new key after a successful order", async () => {
    const keys = [];
    mockFetch.mockImplementation(async (_url, options) => {
      if (options?.method === "PUT") {
        keys.push(options.headers["Idempotency-Key"]);
        return response({
          order: { ...order, order_id: `ORD-${1000 + keys.length}` },
        });
      }
      return response({ products: [{ ...product, quantity: 6 }] });
    });
    await store.dispatch(placeOrder({ productId: "P1001", quantity: 3 }));
    await store.dispatch(placeOrder({ productId: "P1001", quantity: 3 }));
    expect(keys).toHaveLength(2);
    expect(keys[1]).not.toBe(keys[0]);
    expect(store.getState().orders.items).toHaveLength(2);
  });

  it("blocks a second order submission while the first is pending", async () => {
    let completeOrder;
    mockFetch.mockImplementation(async (_url, options) => {
      if (options?.method === "PUT")
        return new Promise((resolve) => {
          completeOrder = resolve;
        });
      return response({ products: [{ ...product, quantity: 9 }] });
    });
    const first = store.dispatch(
      placeOrder({ productId: "P1001", quantity: 3 }),
    );
    const second = await store.dispatch(
      placeOrder({ productId: "P1001", quantity: 3 }),
    );
    expect(second.meta.condition).toBe(true);
    expect(
      mockFetch.mock.calls.filter(([, options]) => options?.method === "PUT"),
    ).toHaveLength(1);
    completeOrder(response({ order }));
    await first;
    expect(store.getState().orders.items).toHaveLength(1);
  });

  it("shows the server's stock error and refreshes inventory after a rejection", async () => {
    mockFetch.mockImplementation(async (_url, options) =>
      options?.method === "PUT"
        ? response(
            {
              error: "INSUFFICIENT_STOCK",
              message: "Only 2 units are available.",
              available_quantity: 2,
            },
            false,
          )
        : response({ products: [{ ...product, quantity: 2 }] }),
    );
    await store.dispatch(placeOrder({ productId: "P1001", quantity: 3 }));
    await vi.waitFor(() =>
      expect(store.getState().products.status).toBe("succeeded"),
    );
    expect(store.getState().orders.error).toBe("Only 2 units are available.");
    expect(store.getState().orders.items).toHaveLength(0);
    expect(store.getState().orders.request).toBeNull();
    expect(store.getState().products.items[0].quantity).toBe(2);
  });
});
