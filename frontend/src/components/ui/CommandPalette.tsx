import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import { Command, Search, X } from "lucide-react";

import { cn } from "@/app/cn";

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

const allCommands: CommandItem[] = [
  {
    name: "Create New Client",
    description: "Add a new client to your database",
    shortcut: "Ctrl+N",
    icon: Command,
    action: () => {
      console.log("Create new client");
    },
  },
  {
    name: "Create New Proposal",
    description: "Start drafting a new proposal",
    shortcut: "Ctrl+Shift+P",
    icon: Command,
    action: () => {
      console.log("Create new proposal");
    },
  },
  {
    name: "Search Clients",
    description: "Find clients by name or contact info",
    shortcut: "Ctrl+F",
    icon: Search,
    action: () => {
      console.log("Search clients");
    },
  },
  {
    name: "View Dashboard",
    description: "Go to the main dashboard",
    shortcut: "Ctrl+D",
    icon: Command,
    action: () => {
      console.log("View dashboard");
    },
  },
  {
    name: "Open Settings",
    description: "Configure application settings",
    shortcut: "Ctrl+,",
    icon: Command,
    action: () => {
      console.log("Open settings");
    },
  },
  {
    name: "Logout",
    description: "End your current session",
    shortcut: "Ctrl+Shift+L",
    icon: X,
    action: () => {
      console.log("Logout");
    },
  },
];

export function CommandPalette({ isOpen, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
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
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }

      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        onOpenChange(!isOpen);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onOpenChange]);

  return (
    <>
      {/* Command Palette Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* Command Palette */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-md">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                placeholder="Search commands..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-card/90 backdrop-blur text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
            </div>

            {commands.length > 0 ? (
              <div className="mt-3 max-h-[70vh] overflow-y-auto space-y-1">
                {commands.slice(0, 8).map((cmd, index) => (
                  <button
                    key={cmd.name}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-200",
                      index === 0 && "bg-primary/10 text-primary border-l-2 border-primary",
                      "hover:bg-card-hover hover:text-text-primary"
                    )}
                    onClick={() => {
                      cmd.action();
                      onOpenChange(false);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {cmd.icon && <cmd.icon className="h-4 w-4" />}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{cmd.name}</p>
                        {cmd.description && (
                          <p className="text-xs text-text-tertiary">{cmd.description}</p>
                        )}
                      </div>
                    </div>
                    {cmd.shortcut && (
                      <span className="text-xs font-medium text-text-tertiary bg-background/50 rounded px-2 py-0.5">
                        {cmd.shortcut}
                      </span>
                    )}
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
      )}
    </>
  );
}
