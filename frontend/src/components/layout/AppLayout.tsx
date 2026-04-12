import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  Command,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorCog,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Sun,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { NavLink, Outlet } from "react-router";

import { cn } from "@/app/cn";
import { getDashboardSummary } from "@/api/dashboard";
import { useAuth } from "@/features/auth/authContext";
import { CommandPalette } from "@/components/ui/CommandPalette";

const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Clients", to: "/clients", icon: Users },
  { label: "Leads", to: "/leads", icon: BriefcaseBusiness },
  { label: "Proposals", to: "/proposals", icon: FolderKanban },
];

const upcomingNavItems = [
  { label: "Projects", icon: FolderKanban },
  { label: "Invoices", icon: BriefcaseBusiness },
  { label: "Analytics", icon: MonitorCog },
];

type ThemePreference = "light" | "dark" | "system";

export function AppLayout() {
  const { logout, user } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboardSummary,
    refetchInterval: 60_000,
  });
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    if (typeof globalThis === "undefined") {
      return "system";
    }

    const stored = globalThis.localStorage.getItem("fundi-theme");
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }

    return "system";
  });
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const unreadNotifications =
    dashboardQuery.data?.unread_notifications_count ?? 0;
  const unreadLabel = unreadNotifications > 99 ? "99+" : unreadNotifications;
  const overdueInvoices = dashboardQuery.data?.overdue_invoices ?? [];
  const upcomingDeadlines =
    dashboardQuery.data?.upcoming_proposal_deadlines.slice(0, 3) ?? [];

  const initials = useMemo(() => {
    const source = user?.full_name?.trim() || user?.email || "ST";
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase();
  }, [user?.email, user?.full_name]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const fullName = user?.full_name?.trim() || "Stero";

    if (hour < 12) {
      return `Good morning, ${fullName}`;
    }
    if (hour < 18) {
      return `Good afternoon, ${fullName}`;
    }
    return `Good evening, ${fullName}`;
  }, [user?.full_name]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    const media = globalThis.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = (preference: ThemePreference) => {
      const systemTheme = media.matches ? "dark" : "light";
      const resolvedTheme =
        preference === "system"
          ? systemTheme
          : preference;

      document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    };

    applyTheme(themePreference);
    globalThis.localStorage.setItem("fundi-theme", themePreference);

    if (themePreference !== "system") {
      return undefined;
    }

    const handleChange = () => applyTheme("system");
    media.addEventListener("change", handleChange);

    return () => {
      media.removeEventListener("change", handleChange);
    };
  }, [themePreference]);

  return (
    <div className="min-h-svh bg-background-secondary text-text-primary">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
        href="#main-content"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-controls="app-drawer"
              aria-expanded={isDrawerOpen}
              aria-label="Open navigation"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-text-secondary transition-colors hover:border-border-hover hover:bg-card-hover hover:text-text-primary lg:hidden"
              onClick={() => setIsDrawerOpen(true)}
              type="button"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                ST
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Stero Tech Inc.
                </p>
                <p className="text-xs text-text-secondary">Company OS</p>
              </div>
            </div>
          </div>

          <div className="hidden flex-1 items-center justify-center lg:flex">
            <div className="min-w-0 text-center">
              <p className="truncate text-sm font-semibold text-text-primary">
                {greeting}
              </p>
              <p className="truncate text-xs text-text-secondary">
                {user?.role ? `${user.role} workspace` : "Keep the pipeline moving."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              aria-label="Open command palette"
              className="hidden h-10 items-center gap-3 rounded-lg border border-border bg-card px-2.5 text-text-secondary transition-colors hover:border-border-hover hover:bg-card-hover hover:text-text-primary md:inline-flex"
              onClick={() => setIsCommandPaletteOpen(true)}
              type="button"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-background text-text-secondary">
                <Command className="h-4 w-4" />
              </span>
              <span className="h-5 w-px bg-divider" />
              <span className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold text-text-tertiary">
                Ctrl K
              </span>
            </button>

            <button
              aria-label="Open command palette"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-text-secondary transition-colors hover:border-border-hover hover:bg-card-hover hover:text-text-primary md:hidden"
              onClick={() => setIsCommandPaletteOpen(true)}
              type="button"
            >
              <Command className="h-4 w-4" />
            </button>

            <div className="relative">
              <button
                aria-expanded={isNotificationPanelOpen}
                aria-haspopup="dialog"
                aria-label={
                  unreadNotifications
                    ? `${unreadNotifications} unread notifications`
                    : "Notifications"
                }
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-text-secondary transition-colors hover:border-border-hover hover:bg-card-hover hover:text-text-primary"
                onClick={() =>
                  setIsNotificationPanelOpen((current) => !current)
                }
                type="button"
              >
                <Bell className="h-4 w-4" />
                {unreadNotifications > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-error px-1.5 py-0.5 text-[0.65rem] font-bold leading-none text-error-foreground">
                    {unreadLabel}
                  </span>
                ) : null}
              </button>

              {isNotificationPanelOpen ? (
                <div
                  className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(23rem,calc(100vw-2rem))] rounded-lg border border-border bg-card p-3 shadow-lg"
                  role="dialog"
                  aria-label="Notification summary"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        Alerts
                      </p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {unreadNotifications} unread notifications
                      </p>
                    </div>
                    <button
                      className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-text-secondary transition-colors hover:border-border-hover hover:bg-card-hover hover:text-text-primary"
                      onClick={() => setIsNotificationPanelOpen(false)}
                      type="button"
                    >
                      Close
                    </button>
                  </div>

                  <div className="mt-3 space-y-3">
                    <div className="rounded-lg bg-background-secondary p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-text-tertiary">
                        Overdue invoices
                      </p>
                      <div className="mt-2 space-y-2">
                        {overdueInvoices.length ? (
                          overdueInvoices.slice(0, 3).map((invoice) => (
                            <div
                              className="flex items-center justify-between gap-3 text-sm"
                              key={invoice.id}
                            >
                              <span className="min-w-0 truncate font-medium text-text-primary">
                                {invoice.client_name}
                              </span>
                              <span className="shrink-0 text-xs font-semibold text-error-hover">
                                {invoice.amount_remaining}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-text-secondary">
                            No overdue invoices.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg bg-background-secondary p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-text-tertiary">
                        Proposal deadlines
                      </p>
                      <div className="mt-2 space-y-2">
                        {upcomingDeadlines.length ? (
                          upcomingDeadlines.map((proposal) => (
                            <div
                              className="flex items-center justify-between gap-3 text-sm"
                              key={proposal.id}
                            >
                              <span className="min-w-0 truncate font-medium text-text-primary">
                                {proposal.title}
                              </span>
                              <span className="shrink-0 text-xs font-semibold text-warning-hover">
                                {proposal.deadline}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-text-secondary">
                            No deadline alerts.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="relative" ref={userMenuRef}>
              <button
                aria-expanded={isUserMenuOpen}
                aria-haspopup="menu"
                aria-label="Open user menu"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-primary-light px-1.5 pr-2 text-xs font-bold text-primary transition-colors hover:border-primary/35 hover:bg-primary-light/80"
                onClick={() => setIsUserMenuOpen((current) => !current)}
                type="button"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  {initials}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-primary" />
              </button>

              {isUserMenuOpen ? (
                <div
                  className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-64 rounded-lg border border-border bg-card p-2 shadow-lg"
                  role="menu"
                >
                  <div className="rounded-md bg-background px-3 py-3">
                    <p className="text-sm font-semibold text-text-primary">
                      {user?.full_name || "Stero"}
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">{user?.email}</p>
                    <p className="mt-2 text-xs font-medium uppercase text-text-tertiary">
                      {user?.role || "workspace user"}
                    </p>
                  </div>

                  <div className="mt-2 space-y-1">
                    <button
                      className="inline-flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary"
                      role="menuitem"
                      type="button"
                    >
                      <UserRound className="h-4 w-4" />
                      <span>Profile</span>
                    </button>

                    <button
                      className="inline-flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary"
                      role="menuitem"
                      type="button"
                    >
                      <Settings2 className="h-4 w-4" />
                      <span>Settings</span>
                    </button>
                  </div>

                  <div className="mt-2 rounded-md border border-border bg-background px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <MonitorCog className="h-4 w-4 text-text-secondary" />
                        <p className="text-sm font-medium text-text-primary">Theme</p>
                      </div>
                      <span className="text-xs text-text-tertiary">
                        {themePreference}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <button
                        aria-label="Use light theme"
                        className={cn(
                          "inline-flex items-center justify-center rounded-md border px-2 py-2 text-xs font-medium transition-colors",
                          themePreference === "light"
                            ? "border-primary bg-primary-light text-primary"
                            : "border-border bg-card text-text-secondary hover:border-border-hover hover:bg-card-hover hover:text-text-primary",
                        )}
                        onClick={() => setThemePreference("light")}
                        type="button"
                        title="Light"
                      >
                        <Sun className="h-4 w-4" />
                      </button>
                      <button
                        aria-label="Use dark theme"
                        className={cn(
                          "inline-flex items-center justify-center rounded-md border px-2 py-2 text-xs font-medium transition-colors",
                          themePreference === "dark"
                            ? "border-primary bg-primary-light text-primary"
                            : "border-border bg-card text-text-secondary hover:border-border-hover hover:bg-card-hover hover:text-text-primary",
                        )}
                        onClick={() => setThemePreference("dark")}
                        type="button"
                        title="Dark"
                      >
                        <Moon className="h-4 w-4" />
                      </button>
                      <button
                        aria-label="Use system theme"
                        className={cn(
                          "inline-flex items-center justify-center rounded-md border px-2 py-2 text-xs font-medium transition-colors",
                          themePreference === "system"
                            ? "border-primary bg-primary-light text-primary"
                            : "border-border bg-card text-text-secondary hover:border-border-hover hover:bg-card-hover hover:text-text-primary",
                        )}
                        onClick={() => setThemePreference("system")}
                        type="button"
                        title="System"
                      >
                        <MonitorCog className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <button
                    className="mt-2 inline-flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary"
                    onClick={async () => {
                      setIsUserMenuOpen(false);
                      await logout();
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="lg:flex">
        <aside
          className={cn(
            "hidden border-r border-border bg-card/90 backdrop-blur-lg transition-[width] duration-200 lg:block lg:shrink-0",
            isSidebarExpanded ? "lg:w-64" : "lg:w-20",
          )}
        >
          <nav className="sticky top-16 flex min-h-[calc(100svh-4rem)] flex-col gap-1 px-3 py-5">
            <button
              aria-label={
                isSidebarExpanded ? "Collapse navigation" : "Expand navigation"
              }
              className={cn(
                "mb-3 inline-flex h-10 items-center rounded-lg border border-border bg-card text-sm font-semibold text-text-secondary transition-colors hover:border-border-hover hover:bg-card-hover hover:text-text-primary",
                isSidebarExpanded ? "justify-between px-3" : "justify-center px-0",
              )}
              onClick={() => setIsSidebarExpanded((current) => !current)}
              type="button"
            >
              <span
                className={cn(
                  "truncate transition-opacity",
                  isSidebarExpanded ? "opacity-100" : "sr-only opacity-0",
                )}
              >
                Navigation
              </span>
              {isSidebarExpanded ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </button>

            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    className={({ isActive }) =>
                      cn(
                        "group flex h-11 items-center rounded-lg text-sm font-medium transition-all duration-200",
                        isSidebarExpanded
                          ? "justify-start gap-3 px-3"
                          : "justify-center px-0",
                        isActive
                          ? "border-l-4 border-primary bg-primary/10 text-primary"
                          : "text-text-secondary hover:bg-card-hover hover:text-text-primary",
                      )
                    }
                    key={item.to}
                    title={isSidebarExpanded ? undefined : item.label}
                    to={item.to}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span
                      className={cn(
                        "truncate transition-opacity",
                        isSidebarExpanded ? "opacity-100" : "sr-only opacity-0",
                      )}
                    >
                      {item.label}
                    </span>
                  </NavLink>
                );
              })}
            </div>

            <div className="mt-4 border-t border-divider pt-4">
              <div className={cn("space-y-1", !isSidebarExpanded && "space-y-2")}>
                {upcomingNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      className={cn(
                        "flex h-11 w-full items-center rounded-lg text-sm font-medium text-text-disabled transition-colors hover:bg-card-hover hover:text-text-secondary",
                        isSidebarExpanded
                          ? "justify-start gap-3 px-3"
                          : "justify-center px-0",
                      )}
                      key={item.label}
                      title={isSidebarExpanded ? undefined : item.label}
                      type="button"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span
                        className={cn(
                          "truncate transition-opacity",
                          isSidebarExpanded ? "opacity-100" : "sr-only opacity-0",
                        )}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <main className="px-4 py-6 sm:px-6 lg:px-8" id="main-content">
            <Outlet />
          </main>
        </div>
      </div>

       {isDrawerOpen ? (
         <div className="fixed inset-0 z-50 lg:hidden">
           <button
             aria-label="Close navigation"
             className="absolute inset-0 bg-text-primary/35 backdrop-blur-[2px]"
             onClick={() => setIsDrawerOpen(false)}
             type="button"
           />

           <aside
             className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-border bg-card/90 backdrop-blur-lg p-6 shadow-xl"
             id="app-drawer"
           >
             <div className="flex items-center justify-between gap-4">
               <div className="flex items-center gap-3">
                 <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                   ST
                 </div>
                 <div>
                   <p className="text-sm font-semibold text-text-primary">
                     Stero Tech Inc.
                   </p>
                   <p className="text-xs text-text-secondary">Company OS</p>
                 </div>
               </div>

               <button
                 aria-label="Close navigation"
                 className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-border bg-card text-text-secondary transition-colors hover:border-border-hover hover:bg-card-hover hover:text-text-primary"
                 onClick={() => setIsDrawerOpen(false)}
                 type="button"
               >
                 <X className="h-6 w-6" />
               </button>
             </div>

             <nav className="mt-8 space-y-2">
               {navItems.map((item) => {
                 const Icon = item.icon;
                 return (
                   <NavLink
                     className={({ isActive }) =>
                       cn(
                         "flex items-center gap-4 rounded-lg px-4 py-3 text-base font-medium transition-all duration-200",
                         isActive
                           ? "bg-primary/10 text-primary border-l-4 border-primary"
                           : "text-text-secondary hover:bg-card-hover hover:text-text-primary hover:bg-primary/5",
                       )
                     }
                     key={item.to}
                     onClick={() => setIsDrawerOpen(false)}
                     to={item.to}
                   >
                     <span className="flex items-center gap-4">
                       <Icon className="h-5 w-5 flex-shrink-0" />
                       <span>{item.label}</span>
                     </span>
                     <ChevronRight className="h-4 w-4" />
                   </NavLink>
                 );
               })}
             </nav>

           </aside>
         </div>
       ) : null}
       <CommandPalette
         isOpen={isCommandPaletteOpen}
         onOpenChange={setIsCommandPaletteOpen}
       />
    </div>
  );
}
