/**
 * NotFound.jsx — 404 catch-all page.
 *
 * Displayed for any URL that doesn't match a defined route. The range's lead
 * jar, lifted off its photograph, leans over the numeral; when no product
 * has a photograph the numeral stands alone. Links back to Home and Shop.
 *
 * @module pages/NotFound
 */
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { useEffect, useState } from "react";
import Cutout from "../components/Cutout";
import { fetchProductsCached } from "../services/products";

export default function NotFound() {
  useDocumentTitle("Page Not Found | Core Atoms");
  const [leadProduct, setLeadProduct] = useState(null);
  useEffect(() => {
    let on = true;
    fetchProductsCached().then((list) => { if (on) setLeadProduct(list?.find((p) => p.image) || null); }).catch(() => {});
    return () => { on = false; };
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center py-12 text-center">
      {leadProduct?.image && (
        <div className="hero-float -mb-6 h-56 w-72 sm:h-64" aria-hidden="true">
          <Cutout src={leadProduct.image} className="hero-jar-enter mx-auto h-full w-auto -rotate-6" />
        </div>
      )}
      <p className="font-display text-[6rem] font-semibold leading-none tracking-[-0.06em] text-ink sm:text-[8.5rem]" aria-hidden="true">404</p>
      <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">That page isn't on the label</h1>
      <p className="mt-2 max-w-sm text-sm text-stone-500">The address doesn't match anything on the site. It may have moved, or the link had a typo.</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link to="/shop" className="btn-primary btn-lg">
          Browse the range
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <Link to="/" className="btn-secondary btn-lg">Go home</Link>
      </div>
    </div>
  );
}
