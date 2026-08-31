/**
 * ProtectedRoute.jsx — Route guard that requires authentication.
 *
 * Redirects to `/login` if the user is not signed in, preserving the
 * current URL as a `redirect` query parameter so the user returns to
 * their intended page after login. `Login` re-validates that parameter
 * before navigating, so only same-origin paths are ever honoured.
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
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${returnTo}`} replace />;
  }

  return children;
}
