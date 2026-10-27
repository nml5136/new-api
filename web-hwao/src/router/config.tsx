import type { RouteObject } from "react-router-dom";
import { Navigate, Outlet } from "react-router-dom";
import AppShell from "@/components/feature/AppShell";
import OpsShell from "@/components/feature/OpsShell";
import AuthGuard from "@/components/feature/AuthGuard";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/home/page";
import PricingPage from "@/pages/pricing/page";
import DocsPage from "@/pages/docs/page";
import LoginPage from "@/pages/login/page";
import ActivatePage from "@/pages/activate/page";
import ResetPasswordPage from "@/pages/reset-password/page";
import OverviewPage from "@/pages/app/overview/page";
import ScenesPage from "@/pages/app/scenes/page";
import WorkspacePage from "@/pages/app/workspace/page";
import ModelsPage from "@/pages/app/models/page";
import ProjectsPage from "@/pages/app/projects/page";
import KeysPage from "@/pages/app/keys/page";
import BudgetsPage from "@/pages/app/budgets/page";
import RequestsPage from "@/pages/app/requests/page";
import BillingPage from "@/pages/app/billing/page";
import RefundsPage from "@/pages/app/refunds/page";
import MembersPage from "@/pages/app/members/page";
import SettingsPage from "@/pages/app/settings/page";
import OpsOverviewPage from "@/pages/ops/overview/page";
import OpsResourcesPage from "@/pages/ops/resources/page";
import OpsScenesPage from "@/pages/ops/scenes/page";
import OpsEvaluationsPage from "@/pages/ops/evaluations/page";
import OpsCustomersPage from "@/pages/ops/customers/page";
import OpsPricingPage from "@/pages/ops/pricing/page";
import OpsFinancePage from "@/pages/ops/finance/page";
import OpsAuditPage from "@/pages/ops/audit/page";

const routes: RouteObject[] = [
  { path: "/", element: <Home /> },
  { path: "/pricing", element: <PricingPage /> },
  { path: "/docs", element: <DocsPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/activate", element: <ActivatePage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  {
    path: "/app",
    element: (
      <AuthGuard need="tenant">
        <AppShell>
          <Outlet />
        </AppShell>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/app/overview" replace /> },
      { path: "overview", element: <OverviewPage /> },
      { path: "scenes", element: <ScenesPage /> },
      { path: "workspace", element: <WorkspacePage /> },
      { path: "models", element: <ModelsPage /> },
      { path: "projects", element: <ProjectsPage /> },
      { path: "keys", element: <KeysPage /> },
      { path: "budgets", element: <BudgetsPage /> },
      { path: "requests", element: <RequestsPage /> },
      { path: "billing", element: <BillingPage /> },
      { path: "refunds", element: <RefundsPage /> },
      { path: "members", element: <MembersPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
  {
    path: "/ops",
    element: (
      <AuthGuard need="staff">
        <OpsShell>
          <Outlet />
        </OpsShell>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/ops/overview" replace /> },
      { path: "overview", element: <OpsOverviewPage /> },
      { path: "resources", element: <OpsResourcesPage /> },
      { path: "scenes", element: <OpsScenesPage /> },
      { path: "evaluations", element: <OpsEvaluationsPage /> },
      { path: "customers", element: <OpsCustomersPage /> },
      { path: "pricing", element: <OpsPricingPage /> },
      { path: "finance", element: <OpsFinancePage /> },
      { path: "audit", element: <OpsAuditPage /> },
    ],
  },
  { path: "*", element: <NotFound /> },
];

export default routes;