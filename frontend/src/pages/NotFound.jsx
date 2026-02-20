import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] grid place-items-center px-4">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm text-center">
        <div className="text-sm text-neutral-500">Core Atoms</div>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-950">404</h1>
        <p className="mt-2 text-sm text-neutral-700">
          The page you’re looking for doesn’t exist.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            to="/"
            className="rounded-xl bg-gradient-to-r from-neutral-200 to-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-950 shadow-sm hover:shadow hover:scale-[1.01] transition"
          >
            Home
          </Link>
          <Link
            to="/shop"
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-900 hover:bg-neutral-50 transition"
          >
            Shop
          </Link>
        </div>
      </div>
    </div>
  );
}
