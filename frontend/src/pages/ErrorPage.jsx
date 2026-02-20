import { Link, useRouteError } from "react-router-dom";

export default function ErrorPage() {
  const err = useRouteError();
  const message =
    err?.statusText ||
    err?.message ||
    "Something went wrong while loading this page.";

  return (
    <div className="min-h-[70vh] grid place-items-center px-4">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="text-sm text-neutral-500">Core Atoms</div>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-950">Page error</h1>
        <p className="mt-2 text-sm text-neutral-700">{message}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/"
            className="rounded-xl bg-gradient-to-r from-neutral-200 to-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-950 shadow-sm hover:shadow hover:scale-[1.01] transition"
          >
            Go Home
          </Link>
          <Link
            to="/shop"
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-900 hover:bg-neutral-50 transition"
          >
            Shop
          </Link>
        </div>

        <details className="mt-6 text-xs text-neutral-600">
          <summary className="cursor-pointer">Technical details</summary>
          <pre className="mt-2 overflow-auto rounded-xl border border-neutral-200 bg-neutral-50 p-3">
{String(err?.stack || err?.message || err)}
          </pre>
        </details>
      </div>
    </div>
  );
}
