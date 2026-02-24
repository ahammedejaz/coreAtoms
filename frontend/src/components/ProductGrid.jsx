/**
 * ProductGrid.jsx — Responsive grid layout for product cards.
 *
 * Renders a list of products in a 1/2/3-column grid using `ProductCard`.
 *
 * @param {{ products: Array, onAddToCart: Function }} props
 * @module components/ProductGrid
 */
import ProductCard from "./ProductCard";

export default function ProductGrid({ products, onAddToCart }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onAddToCart={onAddToCart} />
      ))}
    </div>
  );
}
