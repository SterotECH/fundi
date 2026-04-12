import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { Columns3, SlidersHorizontal } from "lucide-react";
import { useNavigate } from "react-router";

import { cn } from "@/app/cn";
import { Button } from "@/components/ui/Button";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  mobileLabel?: ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
  headerClassName?: string;
  hideOnMobile?: boolean;
  defaultVisible?: boolean;
  width?: string;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  emptyState?: ReactNode;
  getRowHref?: (row: T) => string;
  loading?: boolean;
  mobileCard?: (row: T, index: number) => ReactNode;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  rows: T[];
  searchSlot?: ReactNode;
  filterContent?: ReactNode;
  filterCount?: number;
  toolbar?: ReactNode;
  toolbarActions?: ReactNode;
  enableColumnToggle?: boolean;
  className?: string;
  shellClassName?: string;
};

const alignments: Record<NonNullable<DataTableColumn<unknown>["align"]>, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

function DataTableSkeleton({ columnCount }: { columnCount: number }) {
  return (
    <div className="data-table-shell">
      <div className="hidden md:block">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr className="data-table-head">
              {Array.from({ length: columnCount }).map((_, index) => (
                <th key={index}>
                  <div className="h-3 w-20 animate-shimmer rounded bg-muted-background" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <tr className="data-table-row" key={rowIndex}>
                {Array.from({ length: columnCount }).map((__, cellIndex) => (
                  <td key={cellIndex}>
                    <div className="h-4 w-24 animate-shimmer rounded bg-muted-background" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 p-3 md:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="data-table-mobile-card" key={index}>
            <div className="space-y-3">
              <div className="h-4 w-36 animate-shimmer rounded bg-muted-background" />
              <div className="h-3 w-full animate-shimmer rounded bg-muted-background" />
              <div className="h-3 w-3/4 animate-shimmer rounded bg-muted-background" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DataTable<T>({
  columns,
  emptyState,
  getRowHref,
  loading = false,
  mobileCard,
  onRowClick,
  rowKey,
  rows,
  searchSlot,
  filterContent,
  filterCount = 0,
  toolbar,
  toolbarActions,
  enableColumnToggle = true,
  className,
  shellClassName,
}: DataTableProps<T>) {
  const navigate = useNavigate();
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(
    () => new Set(columns.filter((column) => column.defaultVisible === false).map((column) => column.key)),
  );
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isColumnOpen, setIsColumnOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);

  const handleRowActivate = (row: T) => {
    if (getRowHref) {
      navigate(getRowHref(row));
      return;
    }

    onRowClick?.(row);
  };

  const handleKeyDown = (
    event: ReactKeyboardEvent<HTMLTableRowElement | HTMLDivElement>,
    row: T,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleRowActivate(row);
  };

  const isRowInteractive = Boolean(getRowHref || onRowClick);
  const visibleColumns = columns.filter((column) => !hiddenColumns.has(column.key));
  const showToolbarControls = Boolean(searchSlot || filterContent || toolbarActions || enableColumnToggle);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (filterRef.current && !filterRef.current.contains(target)) {
        setIsFilterOpen(false);
      }

      if (columnRef.current && !columnRef.current.contains(target)) {
        setIsColumnOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFilterOpen(false);
        setIsColumnOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const toggleColumn = (columnKey: string) => {
    setHiddenColumns((current) => {
      const next = new Set(current);
      const currentlyVisibleCount = columns.length - current.size;

      if (next.has(columnKey)) {
        next.delete(columnKey);
      } else {
        if (currentlyVisibleCount <= 1) {
          return current;
        }
        next.add(columnKey);
      }

      return next;
    });
  };

  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        {showToolbarControls ? (
          <div className="data-table-toolbar">
            {searchSlot ? <div className="min-w-0 flex-1">{searchSlot}</div> : <div />}
            <div className="data-table-toolbar-actions">
              {filterContent ? (
                <div className="data-table-popover-shell" ref={filterRef}>
                  <Button
                    leadingIcon={<SlidersHorizontal className="h-4 w-4" />}
                    onClick={() => setIsFilterOpen((current) => !current)}
                    variant="secondary"
                  >
                    Filters
                  </Button>
                </div>
              ) : null}
              {enableColumnToggle ? (
                <div className="data-table-popover-shell" ref={columnRef}>
                  <Button
                    leadingIcon={<Columns3 className="h-4 w-4" />}
                    onClick={() => setIsColumnOpen((current) => !current)}
                    variant="secondary"
                  >
                    Columns
                  </Button>
                </div>
              ) : null}
              {toolbarActions}
            </div>
          </div>
        ) : toolbar ? (
          <div className="data-table-toolbar">{toolbar}</div>
        ) : null}
        <DataTableSkeleton columnCount={visibleColumns.length || columns.length} />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className={cn("space-y-4", className)}>
        {showToolbarControls ? (
          <div className="data-table-toolbar">
            {searchSlot ? <div className="min-w-0 flex-1">{searchSlot}</div> : <div />}
            <div className="data-table-toolbar-actions">
              {filterContent ? (
                <div className="data-table-popover-shell" ref={filterRef}>
                  <Button
                    className="relative"
                    leadingIcon={<SlidersHorizontal className="h-4 w-4" />}
                    onClick={() => {
                      setIsFilterOpen((current) => !current);
                      setIsColumnOpen(false);
                    }}
                    variant="secondary"
                  >
                    Filters
                    {filterCount > 0 ? (
                      <span className="data-table-toolbar-count">{filterCount}</span>
                    ) : null}
                  </Button>
                  {isFilterOpen ? (
                    <div className="data-table-popover">{filterContent}</div>
                  ) : null}
                </div>
              ) : null}
              {enableColumnToggle ? (
                <div className="data-table-popover-shell" ref={columnRef}>
                  <Button
                    leadingIcon={<Columns3 className="h-4 w-4" />}
                    onClick={() => {
                      setIsColumnOpen((current) => !current);
                      setIsFilterOpen(false);
                    }}
                    variant="secondary"
                  >
                    Columns
                  </Button>
                  {isColumnOpen ? (
                    <div className="data-table-popover">
                      <div className="data-table-menu">
                        {columns.map((column) => (
                          <label className="data-table-menu-item" key={column.key}>
                            <input
                              checked={!hiddenColumns.has(column.key)}
                              onChange={() => toggleColumn(column.key)}
                              type="checkbox"
                            />
                            <span>{column.header}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {toolbarActions}
            </div>
          </div>
        ) : toolbar ? (
          <div className="data-table-toolbar">{toolbar}</div>
        ) : null}
        {emptyState}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {showToolbarControls ? (
        <div className="data-table-toolbar">
          {searchSlot ? <div className="min-w-0 flex-1">{searchSlot}</div> : <div />}
          <div className="data-table-toolbar-actions">
            {filterContent ? (
              <div className="data-table-popover-shell" ref={filterRef}>
                <Button
                  className="relative"
                  leadingIcon={<SlidersHorizontal className="h-4 w-4" />}
                  onClick={() => {
                    setIsFilterOpen((current) => !current);
                    setIsColumnOpen(false);
                  }}
                  variant="secondary"
                >
                  Filters
                  {filterCount > 0 ? (
                    <span className="data-table-toolbar-count">{filterCount}</span>
                  ) : null}
                </Button>
                {isFilterOpen ? (
                  <div className="data-table-popover">{filterContent}</div>
                ) : null}
              </div>
            ) : null}
            {enableColumnToggle ? (
              <div className="data-table-popover-shell" ref={columnRef}>
                <Button
                  leadingIcon={<Columns3 className="h-4 w-4" />}
                  onClick={() => {
                    setIsColumnOpen((current) => !current);
                    setIsFilterOpen(false);
                  }}
                  variant="secondary"
                >
                  Columns
                </Button>
                {isColumnOpen ? (
                  <div className="data-table-popover">
                    <div className="data-table-menu">
                      {columns.map((column) => (
                        <label className="data-table-menu-item" key={column.key}>
                          <input
                            checked={!hiddenColumns.has(column.key)}
                            onChange={() => toggleColumn(column.key)}
                            type="checkbox"
                          />
                          <span>{column.header}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {toolbarActions}
          </div>
        </div>
      ) : toolbar ? (
        <div className="data-table-toolbar">{toolbar}</div>
      ) : null}

      <div className={cn("data-table-shell", shellClassName)}>
        <div className="hidden md:block">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="data-table-head">
                {visibleColumns.map((column) => {
                  const style: CSSProperties | undefined = column.width
                    ? { width: column.width }
                    : undefined;

                  return (
                    <th
                      className={cn(
                        alignments[column.align ?? "left"],
                        column.headerClassName,
                      )}
                      key={column.key}
                      style={style}
                    >
                      {column.header}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  aria-label={isRowInteractive ? "Open row" : undefined}
                  className={cn(
                    "data-table-row",
                    isRowInteractive && "data-table-row-clickable",
                  )}
                  key={rowKey(row)}
                  onClick={isRowInteractive ? () => handleRowActivate(row) : undefined}
                  onKeyDown={
                    isRowInteractive ? (event) => handleKeyDown(event, row) : undefined
                  }
                  tabIndex={isRowInteractive ? 0 : undefined}
                >
                  {visibleColumns.map((column) => {
                    const style: CSSProperties | undefined = column.width
                      ? { width: column.width }
                      : undefined;

                    return (
                      <td
                        className={cn(
                          alignments[column.align ?? "left"],
                          column.className,
                        )}
                        key={column.key}
                        style={style}
                      >
                        {column.cell(row, index)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 p-3 md:hidden">
          {rows.map((row, index) => {
            if (mobileCard) {
              return (
                <div
                  className={cn(
                    "data-table-mobile-card",
                    isRowInteractive && "data-table-mobile-card-clickable",
                  )}
                  key={rowKey(row)}
                  onClick={isRowInteractive ? () => handleRowActivate(row) : undefined}
                  onKeyDown={
                    isRowInteractive ? (event) => handleKeyDown(event, row) : undefined
                  }
                  tabIndex={isRowInteractive ? 0 : undefined}
                >
                  {mobileCard(row, index)}
                </div>
              );
            }

            return (
              <div
                className={cn(
                  "data-table-mobile-card",
                  isRowInteractive && "data-table-mobile-card-clickable",
                )}
                key={rowKey(row)}
                onClick={isRowInteractive ? () => handleRowActivate(row) : undefined}
                onKeyDown={
                  isRowInteractive ? (event) => handleKeyDown(event, row) : undefined
                }
                tabIndex={isRowInteractive ? 0 : undefined}
              >
                <div className="space-y-3">
                  {columns
                    .filter((column) => !column.hideOnMobile && !hiddenColumns.has(column.key))
                    .map((column) => (
                      <div
                        className="grid gap-1"
                        key={`${rowKey(row)}-${column.key}`}
                      >
                        <span className="data-table-mobile-label">
                          {column.mobileLabel ?? column.header}
                        </span>
                        <div className={cn("text-sm text-text-primary", column.className)}>
                          {column.cell(row, index)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
