import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import Stars from './Stars.jsx';
import { formatPrice } from '../utils.js';

export default function ProductCard({ product }) {
  const { add } = useCart();

  return (
    <article className="product-card">
      <Link to={`/products/${product.id}`} className="product-card-media">
        <img src={product.image} alt={product.name} loading="lazy" />
        {product.stock === 0 && <span className="badge badge-out">Out of stock</span>}
        {product.stock > 0 && product.stock <= 20 && (
          <span className="badge badge-low">Only {product.stock} left</span>
        )}
      </Link>
      <div className="product-card-body">
        <span className="product-card-category">{product.category}</span>
        <h3 className="product-card-name">
          <Link to={`/products/${product.id}`}>{product.name}</Link>
        </h3>
        <div className="product-card-rating">
          <Stars rating={product.rating} />
          <span>({product.reviews})</span>
        </div>
        <div className="product-card-footer">
          <span className="price">{formatPrice(product.price)}</span>
          <button
            className="btn btn-primary btn-sm"
            disabled={product.stock === 0}
            onClick={() => add(product, 1)}
          >
            Add to cart
          </button>
        </div>
      </div>
    </article>
  );
}
