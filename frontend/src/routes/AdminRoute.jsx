/**
 * AdminRoute.jsx — Route guard that restricts access to admin users only.
 *
 * Redirects to `/login` if unauthenticated, to `/` if authenticated but
 * not an admin. Shows a loading indicator while auth state resolves.
 * Like `ProtectedRoute`, it renders nothing once the URL has already moved
 * to its destination, because the route curtain keeps rendering the leaving
 * page for a beat and a second redirect from there loops.
 *
 * @module routes/AdminRoute
 */
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import RouteFallback from "./RouteFallback";

export default function AdminRoute({ children }) {
  const { loading, isAuthenticated, isAdmin, roleResolved } = useAuth();
  const { pathname } = useLocation();

  if (loading) return <RouteFallback label="Checking access…" />;
  if (!isAuthenticated) return pathname.startsWith("/login") ? null : <Navigate to="/login" replace />;
  // The cached profile deliberately carries no `role`, so gating on `profile`
  // alone bounced admins to `/` on every refresh. Wait for the live role.
  if (!roleResolved) return <RouteFallback label="Checking access…" />;
  if (!isAdmin) return pathname === "/" ? null : <Navigate to="/" replace />;

  return children;
}
