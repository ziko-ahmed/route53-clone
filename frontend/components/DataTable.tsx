"use client";

/**
 * A sortable, selectable table.
 *
 * You give it rows and a description of the columns; it handles the header,
 * sort arrows, selection controls and the loading / empty states.
 *
 * Selection comes in two flavours, picked with the `selection` prop:
 *   single -- radio buttons, for "act on one thing" pages like hosted zones
 *   multi  -- checkboxes plus a select-all box, for bulk operations
 */

import type { ReactNode } from "react";

import { Empty, TableSkeleton } from "./ui";

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  /** If set, the heading becomes clickable and sorts by this backend field. */
  sortKey?: string;
  nowrap?: boolean;
};

export type Selection<T> =
  | { mode: "single"; selected: string | null; onSelect: (row: T) => void }
  | {
      mode: "multi";
      selected: string[];
      onToggle: (row: T) => void;
      onToggleAll: () => void;
    };

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  sort,
  order,
  onSortChange,
  selection,
  empty,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  sort?: string;
  order?: "asc" | "desc";
  onSortChange?: (sortKey: string) => void;
  selection?: Selection<T>;
  empty: { title: string; description: string; action?: ReactNode };
}) {
  if (loading) return <TableSkeleton />;

  if (rows.length === 0) {
    return <Empty title={empty.title} description={empty.description} action={empty.action} />;
  }

  const isSelected = (key: string) =>
    selection?.mode === "single"
      ? selection.selected === key
      : selection?.mode === "multi"
        ? selection.selected.includes(key)
        : false;

  const allSelected =
    selection?.mode === "multi" &&
    rows.length > 0 &&
    rows.every((row) => selection.selected.includes(rowKey(row)));

  const someSelected =
    selection?.mode === "multi" &&
    !allSelected &&
    rows.some((row) => selection.selected.includes(rowKey(row)));

  const handleRowClick = (row: T) => {
    if (!selection) return;
    if (selection.mode === "single") selection.onSelect(row);
    else selection.onToggle(row);
  };

  return (
    <div className="table-scroll">
      <table className="data">
        <thead>
          <tr>
            {selection && (
              <th className="col-select">
                {selection.mode === "multi" ? (
                  <input
                    type="checkbox"
                    checked={allSelected}
                    // "some but not all" shows the dash state
                    ref={(node) => {
                      if (node) node.indeterminate = Boolean(someSelected);
                    }}
                    onChange={selection.onToggleAll}
                    aria-label="Select all rows on this page"
                  />
                ) : (
                  <span className="visually-hidden">Select</span>
                )}
              </th>
            )}
            {columns.map((column) => {
              const sorted = column.sortKey && column.sortKey === sort;
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
                    sorted ? (order === "desc" ? "descending" : "ascending") : undefined
                  }
                >
                  {column.header}
                  {sorted && (
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
            const selected = isSelected(key);
            return (
              <tr
                key={key}
                className={selected ? "selected" : undefined}
                onClick={selection ? () => handleRowClick(row) : undefined}
                style={selection ? { cursor: "pointer" } : undefined}
              >
                {selection && (
                  <td className="col-select">
                    <input
                      type={selection.mode === "multi" ? "checkbox" : "radio"}
                      checked={selected}
                      onChange={() => handleRowClick(row)}
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
