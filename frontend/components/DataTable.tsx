"use client";

/**
 * A sortable, selectable table.
 *
 * You give it the rows and a description of the columns; it handles the
 * header, the sort arrows, the radio buttons for selection and the
 * loading / empty states. Both the zones page and the records page use it.
 */

import type { ReactNode } from "react";

import { Empty, TableSkeleton } from "./ui";

export type Column<T> = {
  /** Column heading. */
  header: string;
  /** How to draw one cell. */
  cell: (row: T) => ReactNode;
  /** If set, the heading becomes clickable and sorts by this backend field. */
  sortKey?: string;
  /** Stops long values from wrapping (used for dates and TTLs). */
  nowrap?: boolean;
};

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  sort,
  order,
  onSortChange,
  selectedKey,
  onSelect,
  empty,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  sort?: string;
  order?: "asc" | "desc";
  onSortChange?: (sortKey: string) => void;
  /** Leave undefined to turn selection off. */
  selectedKey?: string | null;
  onSelect?: (row: T) => void;
  empty: { title: string; description: string; action?: ReactNode };
}) {
  const selectable = Boolean(onSelect);

  if (loading) return <TableSkeleton />;

  if (rows.length === 0) {
    return <Empty title={empty.title} description={empty.description} action={empty.action} />;
  }

  return (
    <div className="table-scroll">
      <table className="data">
        <thead>
          <tr>
            {selectable && (
              <th className="col-select">
                <span className="visually-hidden">Select</span>
              </th>
            )}
            {columns.map((column) => {
              const isSorted = column.sortKey && column.sortKey === sort;
              return (
                <th
                  key={column.header}
                  className={column.sortKey && onSortChange ? "sortable" : undefined}
                  onClick={
                    column.sortKey && onSortChange
                      ? () => onSortChange(column.sortKey as string)
                      : undefined
                  }
                  aria-sort={
                    isSorted ? (order === "desc" ? "descending" : "ascending") : undefined
                  }
                >
                  {column.header}
                  {isSorted && (
                    <span className="sort-arrow" aria-hidden="true">
                      {order === "desc" ? "▼" : "▲"}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const isSelected = selectedKey === key;
            return (
              <tr
                key={key}
                className={isSelected ? "selected" : undefined}
                onClick={selectable ? () => onSelect?.(row) : undefined}
                style={selectable ? { cursor: "pointer" } : undefined}
              >
                {selectable && (
                  <td className="col-select">
                    <input
                      type="radio"
                      checked={isSelected}
                      onChange={() => onSelect?.(row)}
                      aria-label={`Select ${key}`}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.header} className={column.nowrap ? "nowrap" : undefined}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
