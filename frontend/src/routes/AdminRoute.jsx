/**
 * AdminRoute.jsx — Route guard that restricts access to admin users only.
 *
 * Redirects to `/login` if unauthenticated, to `/` if authenticated but
 * not an admin. Shows a loading indicator while auth state resolves.
 *
 * @module routes/AdminRoute
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import RouteFallback from "./RouteFallback";

export default function AdminRoute({ children }) {
  const { loading, isAuthenticated, isAdmin, roleResolved } = useAuth();

  if (loading) return <RouteFallback label="Checking access…" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // The cached profile deliberately carries no `role`, so gating on `profile`
  // alone bounced admins to `/` on every refresh. Wait for the live role.
  if (!roleResolved) return <RouteFallback label="Checking access…" />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return children;
}
