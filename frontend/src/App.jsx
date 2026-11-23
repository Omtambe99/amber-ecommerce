import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  dismissOrderFeedback,
  fetchOrders,
  fetchProduct,
  fetchProducts,
} from "./store";
import { Modal, money, OrderForm, ProductCard, Stock } from "./components";
import Icon from "./Icon";

export default function App() {
  const dispatch = useDispatch();
  const products = useSelector((state) => state.products);
  const orders = useSelector((state) => state.orders);
  const [category, setCategory] = useState("All essentials");
  const [search, setSearch] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchProducts());
    dispatch(fetchOrders());
  }, [dispatch]);

  function openDetails(productId) {
    setDetailOpen(true);
    dispatch(fetchProduct(productId));
  }

  function openOrders() {
    setOrdersOpen(true);
    dispatch(fetchOrders());
  }

  const visibleProducts = products.items.filter(
    (product) =>
      (category === "All essentials" || product.category === category) &&
      product.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <>
      <a className="skip-link" href="#collection">
        Skip to products
      </a>
      <div className="announcement">
        <span>Thoughtful essentials. A little better, every day.</span>
        <span className="demo-label">A practice store · No real payments</span>
      </div>
      <header className="site-header" id="top">
        <div className="container header-inner">
          <a className="brand" href="#top" aria-label="Amber home">
            amber<span>.</span>
          </a>
          <nav aria-label="Main navigation">
            <a href="#collection" className="nav-active">
              The collection
            </a>
            <a href="#how-it-works">How it works</a>
          </nav>
          <button
            type="button"
            className="orders-button"
            onClick={openOrders}
            aria-label={`Your orders (${orders.items.length})`}
          >
            <Icon name="bag" />
            <span>Your orders</span>
            <span className="order-count">{orders.items.length}</span>
          </button>
        </div>
      </header>

      <main className="container">
        <section className="hero" aria-labelledby="hero-heading">
          <div className="hero-copy">
            <p className="eyebrow">THE EVERYDAY EDIT</p>
            <h1 id="hero-heading">
              Small upgrades.
              <br />
              Better <em>everyday.</em>
            </h1>
            <p className="hero-description">
              Good tech should fit right into your life. Discover a considered
              collection for work, play, and everything in between.
            </p>
            <a href="#collection" className="button hero-button">
              Explore the collection
            </a>
            <p className="hero-footnote">
              <span className="mini-line" /> Less clutter. More of what matters.
            </p>
          </div>
          <div className="hero-visual">
            <img
              src="/images/hero.jpg"
              alt="Cream wireless headphones on a softly lit peach surface"
              width="1100"
              height="900"
              fetchPriority="high"
            />
            <span className="hero-image-label">GOOD SOUND. GOOD COMPANY.</span>
            <button
              type="button"
              className="hero-product-link"
              onClick={() => openDetails("P1001")}
            >
              <span>
                <span className="hero-product-eyebrow">
                  MEET YOUR DAILY SOUNDTRACK
                </span>
                <strong>Wireless Headphones</strong>
              </span>
              <span className="hero-product-price">
                {money(2999)}
                <Icon name="plus" size={18} />
              </span>
            </button>
          </div>
        </section>

        <div className="benefits" aria-label="Shopping information">
          <div>
            <Icon name="headphones" size={23} />
            <span>
              Everyday essentials
              <small>Thoughtfully chosen, simply useful.</small>
            </span>
          </div>
          <div>
            <Icon name="shield" size={23} />
            <span>
              Shop with clarity<small>Real stock. No surprises.</small>
            </span>
          </div>
          <div>
            <Icon name="box" size={23} />
            <span>
              A simpler experience<small>Choose it. Order it. Enjoy it.</small>
            </span>
          </div>
        </div>

        <section
          className="collection"
          id="collection"
          aria-labelledby="collection-heading"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE AMBER COLLECTION</p>
              <h2 id="collection-heading">Good things, for your everyday.</h2>
            </div>
            <span className="collection-count">
              {products.items.length} considered essentials
            </span>
          </div>
          <div className="collection-toolbar">
            <div className="category-tabs" aria-label="Filter by category">
              {["All essentials", "Audio", "Workspace", "Accessories"].map(
                (item) => (
                  <button
                    type="button"
                    key={item}
                    className={category === item ? "selected" : ""}
                    onClick={() => setCategory(item)}
                    aria-pressed={category === item}
                  >
                    {item}
                    {item === "All essentials" && (
                      <span>{products.items.length}</span>
                    )}
                  </button>
                ),
              )}
            </div>
            <div className="collection-tools">
              <label className="search-field">
                <Icon name="search" size={17} />
                <input
                  type="search"
                  placeholder="Find an essential…"
                  aria-label="Search products"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="icon-button refresh-button"
                title="Refresh stock"
                aria-label="Refresh stock"
                disabled={products.status === "loading"}
                onClick={() => dispatch(fetchProducts())}
              >
                <Icon name="refresh" size={18} />
              </button>
            </div>
          </div>

          {products.status === "failed" && (
            <div className="notice error" role="alert">
              <span>{products.error}</span>
              <button type="button" onClick={() => dispatch(fetchProducts())}>
                Try again
              </button>
            </div>
          )}
          {products.status === "loading" && products.items.length === 0 && (
            <div
              className="product-grid"
              role="status"
              aria-label="Loading products"
            >
              {[1, 2, 3, 4].map((item) => (
                <div className="product-skeleton" key={item}>
                  <div />
                  <span />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          )}
          {products.items.length > 0 && (
            <div
              className="product-grid"
              aria-busy={products.status === "loading"}
            >
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.product_id}
                  product={product}
                  onDetails={openDetails}
                />
              ))}
            </div>
          )}
          {products.status === "succeeded" && visibleProducts.length === 0 && (
            <div className="empty-state">
              <Icon name="search" size={32} />
              <h3>No essentials found</h3>
              <p>Try another name or explore the full collection.</p>
              <button
                type="button"
                className="button"
                onClick={() => {
                  setSearch("");
                  setCategory("All essentials");
                }}
              >
                Show all products
              </button>
            </div>
          )}
          <p className="collection-note">
            <Icon name="check" size={14} /> Stock is checked with every order
            and updated automatically.
          </p>
        </section>

        <section
          className="how-it-works"
          id="how-it-works"
          aria-labelledby="how-heading"
        >
          <div className="how-intro">
            <p className="eyebrow">KEEPING IT SIMPLE</p>
            <h2 id="how-heading">
              A few clicks.
              <br />
              <em>A good little upgrade.</em>
            </h2>
            <p>
              No accounts. No payment details.
              <br />
              Just a simpler way to try things out.
            </p>
          </div>
          <div className="how-step">
            <span className="step-icon">
              <Icon name="search" size={23} />
            </span>
            <h3>Find your essential</h3>
            <p>Take a look around. Open a product to explore the details.</p>
          </div>
          <div className="how-step">
            <span className="step-icon">
              <Icon name="bag" size={23} />
            </span>
            <h3>Make it yours</h3>
            <p>
              Choose your quantity. We check there’s enough stock before placing
              your order.
            </p>
          </div>
          <div className="how-step">
            <span className="step-icon">
              <Icon name="check" size={23} />
            </span>
            <h3>All taken care of</h3>
            <p>
              Your order is confirmed and the available stock updates. Simple as
              that.
            </p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div>
            <a href="#top" className="brand">
              amber<span>.</span>
            </a>
            <span className="footer-tagline">
              A little thought in everything.
            </span>
          </div>
          <p>A demo collection. Made for learning.</p>
          <a href="#top" className="back-top">
            Back to top
          </a>
        </div>
      </footer>

      {detailOpen && (
        <Modal
          title="Product details"
          onClose={() => setDetailOpen(false)}
          className="product-modal"
        >
          {products.detailStatus === "loading" && (
            <div className="modal-loading" role="status">
              <span className="spinner" /> Getting the details…
            </div>
          )}
          {products.detailStatus === "failed" && (
            <div className="modal-loading">
              <p role="alert">{products.detailError}</p>
              <button
                type="button"
                className="button"
                onClick={() => dispatch(fetchProduct(products.selectedId))}
              >
                Try again
              </button>
            </div>
          )}
          {products.detailStatus === "succeeded" && products.selected && (
            <div className="detail-layout">
              <div
                className={`detail-image image-${products.selected.product_id}`}
              >
                <img
                  src={products.selected.image}
                  alt={products.selected.name}
                  width="640"
                  height="640"
                />
              </div>
              <div className="detail-copy">
                <p className="eyebrow">{products.selected.category}</p>
                <h2>{products.selected.name}</h2>
                <Stock quantity={products.selected.quantity} />
                <p className="detail-price">{money(products.selected.price)}</p>
                <p className="detail-description">
                  {products.selected.description}
                </p>
                <ul className="feature-list">
                  {products.selected.features.map((feature) => (
                    <li key={feature}>
                      <Icon name="check" size={16} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <p className="detail-code">
                  Product ID: {products.selected.product_id}
                </p>
                <OrderForm
                  product={
                    products.items.find(
                      (item) =>
                        item.product_id === products.selected.product_id,
                    ) || products.selected
                  }
                  onOrdered={() => setDetailOpen(false)}
                />
                <p className="detail-note">
                  Practice order only. No payment is required.
                </p>
              </div>
            </div>
          )}
        </Modal>
      )}

      {ordersOpen && (
        <Modal
          title="Your orders"
          onClose={() => setOrdersOpen(false)}
          className="orders-modal"
        >
          <p className="eyebrow">YOUR LITTLE UPGRADES</p>
          <h2 className="orders-heading">
            Your orders<span>.</span>
          </h2>
          <p className="orders-description">
            A little overview of your latest finds.
          </p>
          {orders.listStatus === "loading" && (
            <p className="loading-text" role="status">
              <span className="spinner" /> Loading orders…
            </p>
          )}
          {orders.listStatus === "failed" && (
            <div className="notice error" role="alert">
              <span>{orders.listError}</span>
              <button type="button" onClick={() => dispatch(fetchOrders())}>
                Try again
              </button>
            </div>
          )}
          {orders.listStatus === "succeeded" && orders.items.length === 0 && (
            <div className="empty-state">
              <Icon name="bag" size={38} />
              <h3>Your next essential is waiting.</h3>
              <p>Place an order and you’ll find it here.</p>
              <button
                type="button"
                className="button"
                onClick={() => setOrdersOpen(false)}
              >
                Explore the collection
              </button>
            </div>
          )}
          {orders.listStatus === "succeeded" && (
            <div className="order-list">
              {orders.items.map((order) => (
                <article className="order-item" key={order.order_id}>
                  <img
                    src={
                      products.items.find(
                        (item) => item.product_id === order.product_id,
                      )?.image
                    }
                    alt=""
                    width="72"
                    height="72"
                  />
                  <div className="order-item-info">
                    <span className="order-id">{order.order_id}</span>
                    <h3>{order.product_name}</h3>
                    <p>
                      {order.quantity} × {money(order.unit_price)}
                    </p>
                  </div>
                  <div className="order-item-total">
                    <strong>{money(order.total_amount)}</strong>
                    <span>
                      <Icon name="check" size={12} /> Placed
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
          <p className="orders-footnote">
            This is a shared practice store. Orders and stock reset when the
            server restarts.
          </p>
        </Modal>
      )}

      {orders.status === "succeeded" && orders.latest && (
        <div className="success-toast" role="status">
          <span className="toast-icon">
            <Icon name="check" size={20} />
          </span>
          <div>
            <strong>A good choice. Order placed!</strong>
            <p>
              {orders.latest.order_id} · {orders.latest.quantity} ×{" "}
              {orders.latest.product_name}
            </p>
            <button type="button" onClick={openOrders}>
              View your order · {money(orders.latest.total_amount)}
            </button>
          </div>
          <button
            type="button"
            className="icon-button toast-close"
            onClick={() => dispatch(dismissOrderFeedback())}
            aria-label="Dismiss order confirmation"
          >
            <Icon name="close" size={17} />
          </button>
        </div>
      )}
    </>
  );
}
