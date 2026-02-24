/**
 * ProtectedRoute.jsx — Route guard that requires authentication.
 *
 * Redirects to `/login` if the user is not signed in, preserving the
 * current URL as a `redirect` query parameter so the user returns to
 * their intended page after login.
 *
 * @module routes/ProtectedRoute
 */
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) return <div className="text-neutral-300">Loading...</div>;
  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${returnTo}`} replace />;
  }

  return children;
}
