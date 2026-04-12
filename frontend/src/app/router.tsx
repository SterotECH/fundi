import { createBrowserRouter, Navigate } from "react-router";

import {
  ClientCreateRouteElement,
  ClientDetailRouteElement,
  ClientEditRouteElement,
  ClientsRouteElement,
  DashboardRouteElement,
  InvoiceDetailRouteElement,
  InvoicesRouteElement,
  LeadsRouteElement,
  LoginRouteElement,
  ProposalsRouteElement,
} from "@/app/LazyRouteElements";
import { RouteErrorPage } from "@/app/RouteErrorPage";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginRouteElement />,
    errorElement: <RouteErrorPage />,
  },
  {
    element: <ProtectedRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppLayout />,
        errorElement: <RouteErrorPage />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "/dashboard", element: <DashboardRouteElement /> },
          { path: "/clients", element: <ClientsRouteElement /> },
          { path: "/clients/new", element: <ClientCreateRouteElement /> },
          { path: "/clients/:clientId/edit", element: <ClientEditRouteElement /> },
          { path: "/clients/:clientId", element: <ClientDetailRouteElement /> },
          { path: "/leads", element: <LeadsRouteElement /> },
          { path: "/proposals", element: <ProposalsRouteElement /> },
          { path: "/invoices", element: <InvoicesRouteElement /> },
          { path: "/invoices/:invoiceId", element: <InvoiceDetailRouteElement /> },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />,
    errorElement: <RouteErrorPage />,
  },
]);
