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

export default function AdminRoute({ children }) {
  const { loading, isAuthenticated, isAdmin } = useAuth();

  if (loading) return <div className="text-neutral-300">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return children;
}
