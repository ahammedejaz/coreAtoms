import Button from "./Button";
import { Link } from "react-router-dom";

export default function ProductCard({ product, onAddToCart }) {
  return (
    <div className="group rounded-3xl border border-neutral-200 bg-white  premium-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
      {/* TOP IMAGE: fills the entire top area */}
      <div className="relative h-56 w-full overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-emerald-50">
        {/* subtle overlay so images blend nicely */}
        <div className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(circle_at_20%_10%,#111827,transparent_40%),radial-gradient(circle_at_80%_30%,#111827,transparent_35%)]" />
        <img
          src={product.image}
          alt={product.name}
          className="relative z-10 h-full w-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
          loading="lazy"
        />
      </div>

      {/* CONTENT */}
      <div className="p-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 leading-snug">
              {product.name}
            </h3>
            <p className="text-xs text-neutral-500">
              {product.category || "General"}
            </p>
          </div>
          <div className="text-sm font-semibold text-neutral-900">₹{product.price}</div>
        </div>

        <p className="text-sm text-neutral-600 line-clamp-2">
          {product.description || "Premium, clean nutrition built for daily consistency."}
        </p>

        <div className="flex items-center gap-2 pt-1">
          <Button onClick={() => onAddToCart?.(product)} className="flex-1">
            Add to Cart
          </Button>

          <Link
            to={`/product/${product.id}`}
            className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.02] transition-all duration-200 transform"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
}
