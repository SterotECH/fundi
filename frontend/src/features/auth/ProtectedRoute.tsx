import { Navigate, Outlet, useLocation } from "react-router";

import { useAuth } from "@/features/auth/authContext";

export function ProtectedRoute() {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="grid min-h-svh place-items-center bg-background-secondary px-6 text-sm text-text-secondary">
        Checking session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
