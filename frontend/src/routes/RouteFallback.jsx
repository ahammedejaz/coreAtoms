/**
 * RouteFallback.jsx — Shared loading state for route guards and Suspense.
 *
 * Matches the spinner `MainLayout` uses so guards don't flash near-invisible
 * grey text on the app's warm background.
 *
 * @module routes/RouteFallback
 */
export default function RouteFallback({ label = "Loading…" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24" role="status" aria-live="polite">
      <div className="h-8 w-8 rounded-full border-2 border-stone-200 border-t-[#1e3a5f] animate-spin" />
      <span className="text-sm text-stone-500">{label}</span>
    </div>
  );
}
