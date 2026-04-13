import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import {
  BriefcaseBusiness,
  FolderKanban,
  LayoutDashboard,
  ReceiptText,
  Search,
  Settings2,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router";

import { cn } from "@/app/cn";
import { useAuth } from "@/features/auth/authContext";

type CommandItem = {
  name: string;
  description: string;
  shortcut?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  action: () => void;
};

type CommandPaletteProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export function CommandPalette({ isOpen, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const allCommands = useMemo<CommandItem[]>(
    () => [
      {
        name: "View Dashboard",
        description: "Go to the company overview",
        shortcut: "Ctrl+D",
        icon: LayoutDashboard,
        action: () => navigate("/dashboard"),
      },
      {
        name: "Open Clients",
        description: "Browse schools and institutions",
        shortcut: "Ctrl+1",
        icon: Users,
        action: () => navigate("/clients"),
      },
      {
        name: "Open Leads",
        description: "Review lead pipeline",
        shortcut: "Ctrl+2",
        icon: BriefcaseBusiness,
        action: () => navigate("/leads"),
      },
      {
        name: "Open Proposals",
        description: "Manage proposals and deadlines",
        shortcut: "Ctrl+3",
        icon: FolderKanban,
        action: () => navigate("/proposals"),
      },
      {
        name: "Open Projects",
        description: "Manage delivery, milestones, and hours",
        shortcut: "Ctrl+4",
        icon: FolderKanban,
        action: () => navigate("/projects"),
      },
      {
        name: "Open Invoices",
        description: "Review invoices and payments",
        shortcut: "Ctrl+5",
        icon: ReceiptText,
        action: () => navigate("/invoices"),
      },
      {
        name: "Create New Client",
        description: "Add a new client record",
        shortcut: "Ctrl+N",
        icon: Users,
        action: () => navigate("/clients/new"),
      },
      {
        name: "Open Settings",
        description: "Workspace and account settings",
        shortcut: "Ctrl+,",
        icon: Settings2,
        action: () => onOpenChange(false),
      },
      {
        name: "Logout",
        description: "End your current session",
        shortcut: "Ctrl+Shift+L",
        icon: X,
        action: () => {
          void logout();
        },
      },
    ],
    [logout, navigate, onOpenChange],
  );

  const closePalette = useCallback(() => {
    setQuery("");
    onOpenChange(false);
  }, [onOpenChange]);

  const commands = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return allCommands
      .map((cmd) => {
        const name = cmd.name.toLowerCase();
        const description = cmd.description.toLowerCase();
        const nameMatch = name.includes(normalizedQuery);
        const descMatch = description.includes(normalizedQuery);

        let score = 0;
        if (nameMatch) score += 2;
        if (descMatch) score += 1;
        if (name.startsWith(normalizedQuery)) score += 3;
        if (description.startsWith(normalizedQuery)) score += 1;

        return { ...cmd, score };
      })
      .filter((cmd) => cmd.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [allCommands, query]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePalette();
      }

      if (event.ctrlKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (isOpen) {
          closePalette();
          return;
        }
        onOpenChange(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closePalette, isOpen, onOpenChange]);

  return (
    <>
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          onClick={closePalette}
        />
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-md">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                placeholder="Search commands..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-lg border border-border bg-card/90 py-3 pl-10 pr-4 text-text-primary backdrop-blur placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            </div>

            {commands.length > 0 ? (
              <div className="mt-3 max-h-[70vh] space-y-1 overflow-y-auto">
                {commands.slice(0, 8).map((cmd, index) => (
                  <button
                    key={cmd.name}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-200",
                      index === 0 && "border-l-2 border-primary bg-primary/10 text-primary",
                      "hover:bg-card-hover hover:text-text-primary",
                    )}
                    onClick={() => {
                      cmd.action();
                      closePalette();
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {cmd.icon ? <cmd.icon className="h-4 w-4" /> : null}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{cmd.name}</p>
                        {cmd.description ? (
                          <p className="text-xs text-text-tertiary">{cmd.description}</p>
                        ) : null}
                      </div>
                    </div>
                    {cmd.shortcut ? (
                      <span className="rounded bg-background/50 px-2 py-0.5 text-xs font-medium text-text-tertiary">
                        {cmd.shortcut}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-6 text-center text-text-tertiary">
                <p>No commands found</p>
                <p className="mt-1 text-xs">Try a different search</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
