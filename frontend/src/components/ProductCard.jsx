/**
 * ProductCard.jsx — Premium 3D product card used by `ProductGrid`.
 *
 * Features perspective tilt on hover, glossy image overlay, and
 * multi-layer depth shadows for a premium dimensional feel.
 *
 * @param {{ product: object, onAddToCart: Function }} props
 * @module components/ProductCard
 */
import Button from "./Button";
import { Link } from "react-router-dom";

export default function ProductCard({ product, onAddToCart }) {
  return (
    <div className="group" style={{ perspective: '900px' }}>
      <div
        className="rounded-3xl border border-neutral-200/60 bg-white overflow-hidden transition-all duration-500 ease-out
          group-hover:-translate-y-1.5"
        style={{
          boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.8)',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.5s cubic-bezier(.4,0,.2,1), box-shadow 0.5s cubic-bezier(.4,0,.2,1)',
        }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width - 0.5) * 6;
          const y = ((e.clientY - rect.top) / rect.height - 0.5) * -6;
          e.currentTarget.style.transform = `rotateY(${x}deg) rotateX(${y}deg) translateZ(4px)`;
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08), 0 16px 48px rgba(30,58,95,0.08), 0 0 0 1px rgba(0,0,0,0.02)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'rotateY(0deg) rotateX(0deg) translateZ(0px)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.8)';
        }}
      >
        {/* TOP IMAGE with glossy overlay */}
        <div className="relative h-56 w-full overflow-hidden bg-gradient-to-br from-indigo-50/60 via-white to-emerald-50/60">
          {/* Glossy light reflection */}
          <div className="absolute inset-0 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%, rgba(0,0,0,0.02) 100%)' }} />
          <img
            src={product.image}
            alt={product.name}
            className="relative z-10 h-full w-full object-cover group-hover:scale-[1.06] transition-transform duration-700 ease-out"
            loading="lazy"
            decoding="async"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
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
            <div className="text-right">
              <div className="text-sm font-semibold text-neutral-900">₹{product.price}</div>
              <p className="text-[10px] text-neutral-400 leading-tight">Excl. GST & Shipping</p>
            </div>
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
              className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 hover:-translate-y-0.5 hover:scale-[1.02] transition-all duration-300 transform"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
            >
              View
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
