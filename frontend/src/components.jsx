import { useEffect, useId, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { placeOrder } from "./store";
import Icon from "./Icon";

export function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function Stock({ quantity }) {
  return (
    <span
      className={`stock ${quantity === 0 ? "out" : quantity <= 5 ? "low" : ""}`}
    >
      <span className="stock-dot" />
      {quantity === 0 ? "Out of stock" : `${quantity} available`}
    </span>
  );
}

export function Modal({ title, onClose, className = "", children }) {
  const dialog = useRef(null);
  const titleId = useId();
  useEffect(() => {
    dialog.current.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className={`modal ${className}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
        <button
          type="button"
          className="icon-button modal-close"
          onClick={onClose}
          aria-label="Close dialog"
          autoFocus
        >
          <Icon name="close" />
        </button>
        {children}
      </div>
    </dialog>
  );
}

export function OrderForm({ product, onOrdered }) {
  const dispatch = useDispatch();
  const order = useSelector((state) => state.orders);
  const [quantity, setQuantity] = useState(1);
  const inputId = useId();
  const loading = order.status === "loading";
  const valid =
    Number.isSafeInteger(quantity) &&
    quantity >= 1 &&
    quantity <= product.quantity;
  const isCurrent = order.activeProductId === product.product_id;

  useEffect(() => {
    setQuantity((current) =>
      Math.min(
        Math.max(Number(current) || 1, 1),
        Math.max(product.quantity, 1),
      ),
    );
  }, [product.quantity]);

  async function submit(event) {
    event.preventDefault();
    if (!valid || loading) return;
    try {
      await dispatch(
        placeOrder({ productId: product.product_id, quantity }),
      ).unwrap();
      setQuantity(1);
      onOrdered?.();
    } catch {
      // Redux holds the error so it can be displayed below the form.
    }
  }

  return (
    <form className="order-form" onSubmit={submit}>
      <div className="order-form-label">
        <label htmlFor={inputId}>Quantity</label>
        <span>
          Total:{" "}
          <strong>{money(product.price * (Number(quantity) || 0))}</strong>
        </span>
      </div>
      <div className="order-form-controls">
        <div className="quantity-control">
          <button
            type="button"
            aria-label={`Decrease quantity for ${product.name}`}
            disabled={loading || quantity <= 1 || !product.quantity}
            onClick={() => setQuantity(Number(quantity) - 1)}
          >
            <Icon name="minus" size={15} />
          </button>
          <input
            id={inputId}
            type="number"
            min="1"
            max={product.quantity || 1}
            step="1"
            value={quantity}
            disabled={loading || !product.quantity}
            onChange={(event) =>
              setQuantity(
                event.target.value === "" ? "" : Number(event.target.value),
              )
            }
            aria-label={`Quantity for ${product.name}`}
          />
          <button
            type="button"
            aria-label={`Increase quantity for ${product.name}`}
            disabled={
              loading || quantity >= product.quantity || !product.quantity
            }
            onClick={() => setQuantity(Number(quantity) + 1)}
          >
            <Icon name="plus" size={15} />
          </button>
        </div>
        <button
          type="submit"
          className="button button-order"
          disabled={loading || !product.quantity || !valid}
        >
          {loading && isCurrent ? (
            <>
              <span className="spinner" /> Placing…
            </>
          ) : product.quantity === 0 ? (
            "Sold out"
          ) : (
            <>
              <Icon name="bag" size={16} /> Place order
            </>
          )}
        </button>
      </div>
      {order.status === "failed" && isCurrent && (
        <p className="form-error" role="alert">
          {order.error}
        </p>
      )}
    </form>
  );
}

export function ProductCard({ product, onDetails }) {
  return (
    <article className="product-card">
      <button
        type="button"
        className={`product-image image-${product.product_id}`}
        onClick={() => onDetails(product.product_id)}
        aria-label={`View details for ${product.name}`}
      >
        <img
          src={product.image}
          alt={product.name}
          width="640"
          height="560"
          loading="lazy"
        />
        <span className="image-view">
          View details <Icon name="plus" size={14} />
        </span>
      </button>
      <div className="product-info">
        <div className="product-meta">
          <span className="category-label">{product.category}</span>
          <Stock quantity={product.quantity} />
        </div>
        <h3>
          <button type="button" onClick={() => onDetails(product.product_id)}>
            {product.name}
          </button>
        </h3>
        <p className="product-summary">{product.summary}</p>
        <div className="product-price-row">
          <span className="price">{money(product.price)}</span>
          <span className="product-code">{product.product_id}</span>
        </div>
        <OrderForm product={product} />
      </div>
    </article>
  );
}
