import { lazy, Suspense, type ReactNode } from "react";

import { AppErrorBoundary } from "@/components/error/AppErrorBoundary";
import { LoadingState } from "@/components/status/LoadingState";

const LoginPage = lazy(() =>
  import("@/features/auth/LoginPage").then((module) => ({ default: module.LoginPage })),
);
const DashboardPage = lazy(() =>
  import("@/features/dashboard/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const ClientsPage = lazy(() =>
  import("@/features/clients/ClientsPage").then((module) => ({
    default: module.ClientsPage,
  })),
);
const ClientCreatePage = lazy(() =>
  import("@/features/clients/ClientCreatePage").then((module) => ({
    default: module.ClientCreatePage,
  })),
);
const ClientEditPage = lazy(() =>
  import("@/features/clients/ClientEditPage").then((module) => ({
    default: module.ClientEditPage,
  })),
);
const ClientDetailPage = lazy(() =>
  import("@/features/clients/ClientDetailPage").then((module) => ({
    default: module.ClientDetailPage,
  })),
);
const LeadsPage = lazy(() =>
  import("@/features/leads/LeadsPage").then((module) => ({ default: module.LeadsPage })),
);
const ProposalsPage = lazy(() =>
  import("@/features/proposals/ProposalsPage").then((module) => ({
    default: module.ProposalsPage,
  })),
);
const InvoicesPage = lazy(() =>
  import("@/features/invoices/InvoicesPage").then((module) => ({
    default: module.InvoicesPage,
  })),
);
const InvoiceDetailPage = lazy(() =>
  import("@/features/invoices/InvoiceDetailPage").then((module) => ({
    default: module.InvoiceDetailPage,
  })),
);

function withSuspense(node: ReactNode) {
  return (
    <AppErrorBoundary fallbackDescription="This screen failed to render. Reload and try again.">
      <Suspense fallback={<LoadingState />}>{node}</Suspense>
    </AppErrorBoundary>
  );
}

export function LoginRouteElement() {
  return withSuspense(<LoginPage />);
}

export function DashboardRouteElement() {
  return withSuspense(<DashboardPage />);
}

export function ClientsRouteElement() {
  return withSuspense(<ClientsPage />);
}

export function ClientCreateRouteElement() {
  return withSuspense(<ClientCreatePage />);
}

export function ClientEditRouteElement() {
  return withSuspense(<ClientEditPage />);
}

export function ClientDetailRouteElement() {
  return withSuspense(<ClientDetailPage />);
}

export function LeadsRouteElement() {
  return withSuspense(<LeadsPage />);
}

export function ProposalsRouteElement() {
  return withSuspense(<ProposalsPage />);
}

export function InvoicesRouteElement() {
  return withSuspense(<InvoicesPage />);
}

export function InvoiceDetailRouteElement() {
  return withSuspense(<InvoiceDetailPage />);
}
