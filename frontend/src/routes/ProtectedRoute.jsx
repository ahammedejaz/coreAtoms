/**
 * ProtectedRoute.jsx — Route guard that requires authentication.
 *
 * Redirects to `/login` if the user is not signed in, preserving the
 * current URL as a `redirect` query parameter so the user returns to
 * their intended page after login. `Login` re-validates that parameter
 * before navigating, so only same-origin paths are ever honoured.
 *
 * The route curtain keeps the leaving page on screen for a beat after the
 * URL has changed, so this guard can be rendered while the location is
 * already `/login?redirect=…`. Redirecting again from there nested the
 * parameter inside itself on every render until React gave up ("Maximum
 * update depth exceeded"), so the guard renders nothing once it is no longer
 * the current page.
 *
 * @module routes/ProtectedRoute
 */
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import RouteFallback from "./RouteFallback";

export default function ProtectedRoute({ children }) {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) return <RouteFallback />;
  if (!isAuthenticated) {
    if (location.pathname.startsWith("/login")) return null;
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${returnTo}`} replace />;
  }

  return children;
}
