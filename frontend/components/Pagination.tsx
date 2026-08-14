"use client";

/**
 * Page numbers under a table.
 *
 * When there are many pages we show the first, the last, and the ones
 * around the current page, with "…" in between -- the same shape the AWS
 * console uses.
 */

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <span className="pagination-info">
        {total === 0 ? "No results" : `${first}-${last} of ${total}`}
        <select
          className="select"
          style={{ width: "auto", marginLeft: 12, height: 28, minHeight: 28 }}
          value={pageSize}
          aria-label="Rows per page"
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {[10, 20, 50].map((size) => (
            <option key={size} value={size}>
              {size} per page
            </option>
          ))}
        </select>
      </span>

      <button
        className="page-btn"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        ‹
      </button>

      {pageNumbers(page, totalPages).map((entry, index) =>
        entry === "gap" ? (
          <span key={`gap-${index}`} className="page-btn" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={entry}
            className={entry === page ? "page-btn current" : "page-btn"}
            onClick={() => onPageChange(entry)}
            aria-label={`Page ${entry}`}
            aria-current={entry === page ? "page" : undefined}
          >
            {entry}
          </button>
        ),
      )}

      <button
        className="page-btn"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        ›
      </button>
    </div>
  );
}

/** Works out which page numbers to show, e.g. [1, "gap", 4, 5, 6, "gap", 20]. */
function pageNumbers(page: number, totalPages: number): (number | "gap")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const result: (number | "gap")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  if (start > 2) result.push("gap");
  for (let n = start; n <= end; n += 1) result.push(n);
  if (end < totalPages - 1) result.push("gap");
  result.push(totalPages);

  return result;
}
