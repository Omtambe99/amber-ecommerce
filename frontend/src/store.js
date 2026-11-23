import {
  configureStore,
  createAsyncThunk,
  createSlice,
} from "@reduxjs/toolkit";

// Vite forwards /api to Express in development. Express serves both after a build.
const API_URL = (import.meta.env?.VITE_API_URL || "/api")
  .trim()
  .replace(/\/+$/, "");

async function apiRequest(route, options) {
  const response = await fetch(`${API_URL}${route}`, options);
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || "Could not complete the request.");
    error.code = data.error;
    throw error;
  }
  return data;
}

export const fetchProducts = createAsyncThunk("products/fetch", async () => {
  const data = await apiRequest("/products");
  return data.products;
});

export const fetchProduct = createAsyncThunk(
  "products/details",
  async (productId) => {
    const data = await apiRequest(`/products/${encodeURIComponent(productId)}`);
    return data.product;
  },
);

export const fetchOrders = createAsyncThunk("orders/fetch", async () => {
  const data = await apiRequest("/orders");
  return data.orders;
});

export const placeOrder = createAsyncThunk(
  "orders/place",
  async ({ productId, quantity }, { dispatch, getState }) => {
    const previous = getState().orders.request;
    // A retry after a lost connection uses the same key. A new order gets a new key.
    const key =
      previous?.productId === productId && previous.quantity === quantity
        ? previous.key
        : crypto.randomUUID();
    dispatch(orderSlice.actions.rememberRequest({ productId, quantity, key }));

    try {
      const data = await apiRequest("/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ product_id: productId, quantity }),
      });
      return data.order;
    } finally {
      // Always read authoritative stock; never subtract twice for a replayed order.
      dispatch(fetchProducts());
    }
  },
  {
    condition: (_args, { getState }) => getState().orders.status !== "loading",
  },
);

const productSlice = createSlice({
  name: "products",
  initialState: {
    items: [],
    status: "idle",
    error: null,
    selected: null,
    selectedId: null,
    detailStatus: "idle",
    detailError: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = action.payload;
      })
      .addCase(fetchProducts.rejected, (state) => {
        state.status = "failed";
        state.error =
          "We could not refresh the products. Check that the backend is running and try again.";
      })
      .addCase(fetchProduct.pending, (state, action) => {
        state.selectedId = action.meta.arg;
        state.selected = null;
        state.detailStatus = "loading";
        state.detailError = null;
      })
      .addCase(fetchProduct.fulfilled, (state, action) => {
        if (state.selectedId !== action.meta.arg) return;
        state.selected = action.payload;
        state.detailStatus = "succeeded";
        const index = state.items.findIndex(
          (item) => item.product_id === action.payload.product_id,
        );
        if (index !== -1) state.items[index] = action.payload;
      })
      .addCase(fetchProduct.rejected, (state, action) => {
        if (state.selectedId !== action.meta.arg) return;
        state.detailStatus = "failed";
        state.detailError =
          action.error.message || "Could not load this product.";
      });
  },
});

const orderSlice = createSlice({
  name: "orders",
  initialState: {
    items: [],
    latest: null,
    status: "idle",
    error: null,
    request: null,
    activeProductId: null,
    listStatus: "idle",
    listError: null,
  },
  reducers: {
    rememberRequest(state, action) {
      state.request = action.payload;
    },
    dismissOrderFeedback(state) {
      if (state.status !== "loading") {
        state.status = "idle";
        state.error = null;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(placeOrder.pending, (state, action) => {
        state.status = "loading";
        state.activeProductId = action.meta.arg.productId;
        state.error = null;
      })
      .addCase(placeOrder.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.latest = action.payload;
        state.request = null;
        if (
          !state.items.some(
            (order) => order.order_id === action.payload.order_id,
          )
        ) {
          state.items.unshift(action.payload);
        }
      })
      .addCase(placeOrder.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.code
          ? action.error.message
          : "The connection was interrupted. Retry with the same quantity to safely check this order.";
        // A server response is final. A connection failure may need a safe retry.
        if (action.error.code) state.request = null;
      })
      .addCase(fetchOrders.pending, (state) => {
        state.listStatus = "loading";
        state.listError = null;
      })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.listStatus = "succeeded";
        state.items = action.payload;
      })
      .addCase(fetchOrders.rejected, (state) => {
        state.listStatus = "failed";
        state.listError = "We could not load your orders. Please try again.";
      });
  },
});

export const { dismissOrderFeedback } = orderSlice.actions;

// A factory also lets each test use a fresh, independent Redux store.
export function createStore() {
  return configureStore({
    reducer: { products: productSlice.reducer, orders: orderSlice.reducer },
  });
}

export const store = createStore();
