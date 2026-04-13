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
const AnalyticsPage = lazy(() =>
  import("@/features/analytics/AnalyticsPage").then((module) => ({
    default: module.AnalyticsPage,
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
const ProposalDetailPage = lazy(() =>
  import("@/features/proposals/ProposalDetailPage").then((module) => ({
    default: module.ProposalDetailPage,
  })),
);
const InvoicesPage = lazy(() =>
  import("@/features/invoices/InvoicesPage").then((module) => ({
    default: module.InvoicesPage,
  })),
);
const ProjectsPage = lazy(() =>
  import("@/features/projects/ProjectsPage").then((module) => ({
    default: module.ProjectsPage,
  })),
);
const ProjectDetailPage = lazy(() =>
  import("@/features/projects/ProjectDetailPage").then((module) => ({
    default: module.ProjectDetailPage,
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

export function AnalyticsRouteElement() {
  return withSuspense(<AnalyticsPage />);
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

export function ProposalDetailRouteElement() {
  return withSuspense(<ProposalDetailPage />);
}

export function InvoicesRouteElement() {
  return withSuspense(<InvoicesPage />);
}

export function ProjectsRouteElement() {
  return withSuspense(<ProjectsPage />);
}

export function ProjectDetailRouteElement() {
  return withSuspense(<ProjectDetailPage />);
}

export function InvoiceDetailRouteElement() {
  return withSuspense(<InvoiceDetailPage />);
}
