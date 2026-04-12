import { createBrowserRouter, Navigate } from "react-router";

import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { ClientCreatePage } from "@/features/clients/ClientCreatePage";
import { ClientDetailPage } from "@/features/clients/ClientDetailPage";
import { ClientEditPage } from "@/features/clients/ClientEditPage";
import { ClientsPage } from "@/features/clients/ClientsPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { LeadsPage } from "@/features/leads/LeadsPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { ProposalsPage } from "@/features/proposals/ProposalsPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/clients", element: <ClientsPage /> },
          { path: "/clients/new", element: <ClientCreatePage /> },
          { path: "/clients/:clientId/edit", element: <ClientEditPage /> },
          { path: "/clients/:clientId", element: <ClientDetailPage /> },
          { path: "/leads", element: <LeadsPage /> },
          { path: "/proposals", element: <ProposalsPage /> },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />,
  },
]);
