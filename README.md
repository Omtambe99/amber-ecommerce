# Amber E-Commerce

A small interview-practice project built with **React, Redux Toolkit, Node.js, and Express**. The browser talks to the backend through a REST API. All products, orders, and idempotency keys stay in backend memory; there is no database.

The storefront includes four sample products, product details, quantity controls, order confirmation, and an order list. Search and category buttons help browse the collection. No accounts or payments are needed.

## Run locally

Use Node.js 22.12 or newer within the Node 22 release line.

```powershell
npm ci
cd frontend
npm ci
cd ..
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Health check: http://localhost:3001/api/health

Vite forwards `/api` requests to Express. You do not need an environment file for local development.

If another server already uses port 3001, use a different backend port. The frontend proxy follows the same setting:

```powershell
$env:PORT = "3002"
npm run dev
```

To serve a built frontend and the API from Express alone:

```powershell
npm run build
npm start
```

Open http://localhost:3001, or the port you configured.

## Where to read the code

| File                          | What it does                                                 |
| ----------------------------- | ------------------------------------------------------------ |
| `backend/products.js`         | Four sample products and their initial stock                 |
| `backend/app.js`              | REST routes, validation, order lock, and idempotency records |
| `backend/server.js`           | Starts Express on `PORT`                                     |
| `frontend/src/App.jsx`        | Product dashboard, details dialog, and order list            |
| `frontend/src/components.jsx` | Product card, quantity form, and shared dialog               |
| `frontend/src/store.js`       | Redux state and REST requests                                |
| `backend.test.mjs`            | API and concurrent-order tests                               |
| `frontend/store.test.mjs`     | Redux ordering and safe-retry tests                          |

Product data includes `product_id`, `name`, `price`, and `quantity`, plus a description, category, image, and a few display details. Prices are in Indian rupees. `quantity` on a product means **stock remaining**; `quantity` on an order means **units purchased**.

## REST API

| Method | Route                      | Purpose                                            |
| ------ | -------------------------- | -------------------------------------------------- |
| GET    | `/api/products`            | List products, prices, and current stock           |
| GET    | `/api/products/:productId` | Get a product's details                            |
| PUT    | `/api/orders`              | Place an order                                     |
| POST   | `/api/orders`              | Also supports placing an order                     |
| GET    | `/api/orders`              | List this shared demo store's orders, newest first |
| GET    | `/api/orders/:orderId`     | Get one order                                      |
| GET    | `/api/health`              | Check that the backend is running                  |

### Place an order

```http
PUT /api/orders
Content-Type: application/json
Idempotency-Key: example-order-1

{
  "product_id": "P1001",
  "quantity": 2
}
```

The backend generates the order ID and calculates the price. The frontend does not decide either value. A successful response has status `201` and an `order` object containing the ID, product, quantity, unit price, total amount, status, and creation time.

Example in PowerShell:

```powershell
$orderBody = @{ product_id = "P1001"; quantity = 2 } | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri "http://localhost:3001/api/orders" `
  -Headers @{ "Idempotency-Key" = "example-order-1" } `
  -ContentType "application/json" -Body $orderBody
```

| Situation                                | Response                                            |
| ---------------------------------------- | --------------------------------------------------- |
| New valid order                          | `201`, stock reduced once                           |
| Same key and same product/quantity       | Original response; stock unchanged                  |
| Same key with different product/quantity | `409 IDEMPOTENCY_KEY_CONFLICT`                      |
| Not enough stock                         | `409 INSUFFICIENT_STOCK`, with `available_quantity` |
| Invalid quantity or missing order fields | `400 INVALID_ORDER`                                 |
| Missing idempotency key                  | `400 IDEMPOTENCY_KEY_REQUIRED`                      |
| Missing product                          | `404 PRODUCT_NOT_FOUND`                             |

## The race condition, explained simply

Imagine a product has one unit left and two people try to buy it.

1. Each order enters a small Promise queue, which acts as a lock.
2. The first order checks stock, creates the order, and reduces stock to zero.
3. It saves its idempotency result **before releasing the lock**.
4. The next order checks the updated stock and gets an insufficient-stock response.

The **lock** stops different orders from buying the same final unit. The **idempotency key** stops retries of one order from buying it twice. They solve different problems.

The same key and request always return the original saved response, including a failed stock check. Invalid request fields are rejected before entering the queue. Use a new key when starting a different order.

The frontend generates keys with `crypto.randomUUID()`, keeps the key if a connection failure leaves the result uncertain, and reuses it when retrying the same product and quantity. It disables order controls during submission and refreshes stock from the API rather than subtracting stock locally.

## Tests

Run from the repository root after installing both sets of dependencies:

```powershell
npm test
```

There are 47 automated tests:

| Area               | Cases                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Products           | Listing, details, missing products, and fresh in-memory data                                                                     |
| Orders             | PUT and POST, generated IDs, correct totals, history, and missing orders                                                         |
| Validation         | Missing fields/keys, invalid IDs/keys, negative/fractional/string quantities, and malformed JSON                                 |
| Inventory          | Stock reduction, rejected orders leaving stock unchanged, exact-stock purchases, and sold-out products                           |
| Concurrency        | 25 orders competing for 15 units; exactly 15 succeed and 10 fail                                                                 |
| Duplicate requests | 20 simultaneous requests with one key create exactly one order                                                                   |
| Key conflicts      | Sequential and simultaneous reuse with different details; later orders still work                                                |
| Frontend           | Product fetching, safe network retries, fresh keys for new orders, duplicate-click prevention, and stock refresh after rejection |
| Deployment         | Render health check, browser PUT preflight, and the configured Vercel origin |

Manual check: open a product, select two units, and place an order. Confirm that an order ID appears, stock drops by two, and the order appears under **Your orders**. Invalid quantities and sold-out products cannot be submitted.

## Deploy the backend on Render

Create a **Web Service** from this GitHub repository. The included `render.yaml` can also be imported as a Render Blueprint.

| Setting           | Value                                  |
| ----------------- | -------------------------------------- |
| Root directory    | Repository root; leave the field empty |
| Runtime           | Node                                   |
| Build command     | `npm ci --omit=dev`                    |
| Start command     | `npm start`                            |
| Health check path | `/api/health`                          |
| Node version      | 22, configured in `.node-version`      |

Render supplies `PORT`; the server listens on `0.0.0.0`. After deployment, check `https://YOUR-BACKEND.onrender.com/api/health`. See [Render's Express deployment guide](https://render.com/docs/deploy-node-express-app).

## Deploy the frontend on Vercel

Import the same GitHub repository and use these settings:

| Setting              | Value                                                |
| -------------------- | ---------------------------------------------------- |
| Root directory       | `frontend`                                           |
| Framework            | Vite                                                 |
| Install command      | `npm ci`                                             |
| Build command        | `npm run build`                                      |
| Output directory     | `dist`                                               |
| Environment variable | `VITE_API_URL=https://YOUR-BACKEND.onrender.com/api` |

Replace the example backend URL with the actual Render URL. Include `/api`. Set the variable for the Vercel environments you plan to use. Vite reads it during the build, so redeploy the frontend after changing it. `frontend/vercel.json` supplies the build settings. See [Vercel's Vite guide](https://vercel.com/docs/frameworks/frontend/vite).

Once Vercel gives you a frontend URL, add `CLIENT_ORIGIN=https://YOUR-FRONTEND.vercel.app` in Render's environment settings and redeploy the backend. Use the origin only, without a path or trailing slash. If you leave it unset, this public practice API allows cross-origin requests from any origin. An example for each side is included in `.env.example`.

## Keep in mind

All visitors share the same sample inventory and order list. **Stock, orders, and retry keys reset whenever the backend restarts or redeploys.** Run one backend instance: an in-memory lock does not coordinate multiple server processes. This is intentional for the interview exercise.

Sample photos are illustrative: [Unsplash](https://unsplash.com) and the [Macally USB-C hub reference](https://macally-europe.com/ucdock). They are stored locally under `frontend/public/images`.
