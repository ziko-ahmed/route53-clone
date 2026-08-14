"use client";

/**
 * One hosted zone: its details at the top, then its DNS records with full
 * create / edit / delete, search, filter, sort and pagination.
 */

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Column, DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import { Alert, Button, Field, SearchBox, TypeBadge, ZoneTypeBadge } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { formatDate, humanTtl } from "@/lib/format";
import { useToast } from "@/lib/toast";
import type { DnsRecord, HostedZone, RecordType } from "@/lib/types";
import { useDebounced } from "@/lib/useDebounced";

// SOA is created automatically and cannot be added by hand, but it can be
// filtered for, so it appears in the filter list only.
const FILTERABLE_EXTRA_TYPES = ["SOA"];

export default function ZoneDetailPage() {
  const { zoneId } = useParams<{ zoneId: string }>();
  const router = useRouter();
  const toast = useToast();

  const [zone, setZone] = useState<HostedZone | null>(null);
  const [zoneError, setZoneError] = useState("");
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);

  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput);
  const [typeFilter, setTypeFilter] = useState("");
  const [sort, setSort] = useState("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selected, setSelected] = useState<DnsRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DnsRecord | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Load the zone itself and the list of record types once.
  useEffect(() => {
    api.getZone(zoneId).then(setZone).catch((problem) => {
      setZoneError(problem instanceof Error ? problem.message : "Could not load the zone.");
    });
    api.recordTypes().then(setRecordTypes).catch(() => setRecordTypes([]));
  }, [zoneId]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listRecords(zoneId, {
        search,
        type: typeFilter,
        sort,
        order,
        page,
        page_size: pageSize,
      });
      setRecords(result.items);
      setTotal(result.total);
      setTotalPages(result.total_pages);
    } catch (problem) {
      toast.error(problem instanceof Error ? problem.message : "Could not load records.");
      setRecords([]);
    } finally {
      setLoading(false);
    }
    // toast is stable but not memoised, so it is deliberately left out here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId, search, typeFilter, sort, order, page, pageSize]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    setPage(1);
    setSelected(null);
  }, [search, typeFilter, pageSize]);

  /** Refresh both the record list and the zone's record count. */
  async function refreshAll() {
    await loadRecords();
    api.getZone(zoneId).then(setZone).catch(() => undefined);
  }

  function toggleSort(key: string) {
    if (key === sort) setOrder(order === "asc" ? "desc" : "asc");
    else {
      setSort(key);
      setOrder("asc");
    }
  }

  if (zoneError) {
    return (
      <>
        <Breadcrumbs
          trail={[
            { label: "Route 53", href: "/hosted-zones" },
            { label: "Hosted zones", href: "/hosted-zones" },
            { label: zoneId },
          ]}
        />
        <Alert kind="error">{zoneError}</Alert>
        <Button onClick={() => router.push("/hosted-zones")}>Back to hosted zones</Button>
      </>
    );
  }

  const columns: Column<DnsRecord>[] = [
    {
      header: "Record name",
      sortKey: "name",
      cell: (record) => (
        <button
          className="btn-plain"
          style={{
            background: "none",
            border: 0,
            padding: 0,
            color: "var(--link)",
            textAlign: "left",
          }}
          onClick={(event) => {
            event.stopPropagation();
            setSelected(record);
            setDetailsOpen(true);
          }}
        >
          {record.name}
        </button>
      ),
    },
    {
      header: "Type",
      sortKey: "type",
      cell: (record) => <TypeBadge type={record.type} />,
    },
    {
      header: "Routing policy",
      cell: (record) => record.routing_policy,
    },
    {
      header: "Value / Route traffic to",
      cell: (record) => (
        <div className="cell-values mono">
          {record.values.map((value, index) => (
            <span key={index}>{value}</span>
          ))}
        </div>
      ),
    },
    {
      header: "TTL (seconds)",
      sortKey: "ttl",
      nowrap: true,
      cell: (record) => (
        <>
          {record.ttl} <span className="cell-muted">({humanTtl(record.ttl)})</span>
        </>
      ),
    },
  ];

  const allFilterTypes = [...recordTypes.map((t) => t.type), ...FILTERABLE_EXTRA_TYPES];

  return (
    <>
      <Breadcrumbs
        trail={[
          { label: "Route 53", href: "/hosted-zones" },
          { label: "Hosted zones", href: "/hosted-zones" },
          { label: zone?.name ?? zoneId },
        ]}
      />

      <div className="page-header">
        <div>
          <h1>{zone?.name ?? "Loading…"}</h1>
          {zone?.comment && <p className="page-description">{zone.comment}</p>}
        </div>
        <div className="btn-row">
          <Button onClick={() => router.push("/hosted-zones")}>Back to hosted zones</Button>
        </div>
      </div>

      {/* ---- zone details ---- */}
      <div className="container" style={{ marginBottom: 20 }}>
        <div className="container-header">
          <h2>Hosted zone details</h2>
        </div>
        <div className="container-body">
          {zone ? (
            <div className="kv-grid">
              <div>
                <div className="kv-label">Hosted zone ID</div>
                <div className="kv-value mono">{zone.id}</div>
              </div>
              <div>
                <div className="kv-label">Type</div>
                <div className="kv-value">
                  <ZoneTypeBadge type={zone.type} />
                </div>
              </div>
              <div>
                <div className="kv-label">Record count</div>
                <div className="kv-value">{zone.record_count}</div>
              </div>
              <div>
                <div className="kv-label">Created</div>
                <div className="kv-value">{formatDate(zone.created_at)}</div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div className="kv-label">Name servers</div>
                <div className="kv-value mono cell-values">
                  {zone.name_servers.map((server) => (
                    <span key={server}>{server}</span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="skeleton-bar" style={{ margin: 0, width: "60%" }} />
          )}
        </div>
      </div>

      {/* ---- records ---- */}
      <div className="container">
        <div className="container-header">
          <div className="container-title">
            <h2>
              Records <span className="counter">({total})</span>
            </h2>
          </div>
          <div className="btn-row">
            <Button onClick={refreshAll} title="Refresh the list">
              ⟳
            </Button>
            <Button
              variant="danger"
              disabled={!selected || selected.is_system}
              title={selected?.is_system ? "Default records cannot be deleted" : undefined}
              onClick={() => setDeleteOpen(true)}
            >
              Delete record
            </Button>
            <Button
              disabled={!selected || selected.is_system}
              title={selected?.is_system ? "Default records cannot be edited" : undefined}
              onClick={() => {
                setEditing(selected);
                setFormOpen(true);
              }}
            >
              Edit record
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Create record
            </Button>
          </div>
        </div>

        <div className="toolbar">
          <SearchBox
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Find records by name or value"
          />
          <select
            className="select"
            style={{ width: "auto" }}
            value={typeFilter}
            aria-label="Filter by record type"
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="">All record types</option>
            {allFilterTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {(searchInput || typeFilter) && (
            <Button
              variant="plain"
              small
              onClick={() => {
                setSearchInput("");
                setTypeFilter("");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        <DataTable
          rows={records}
          columns={columns}
          rowKey={(record) => String(record.id)}
          loading={loading}
          sort={sort}
          order={order}
          onSortChange={toggleSort}
          selectedKey={selected ? String(selected.id) : null}
          onSelect={(record) =>
            setSelected(selected?.id === record.id ? null : record)
          }
          empty={{
            title: search || typeFilter ? "No matching records" : "No records yet",
            description:
              search || typeFilter
                ? "Try a different search term or clear the filters."
                : "Add an A, CNAME or MX record to point this domain somewhere.",
            action: (
              <Button
                variant="primary"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Create record
              </Button>
            ),
          }}
        />

        {!loading && records.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

      <RecordFormDialog
        open={formOpen}
        zone={zone}
        record={editing}
        recordTypes={recordTypes}
        onClose={() => setFormOpen(false)}
        onSaved={(record, wasEdit) => {
          toast.success(
            wasEdit ? `Record ${record.name} updated.` : `Record ${record.name} created.`,
          );
          setFormOpen(false);
          setSelected(null);
          refreshAll();
        }}
        onError={(message) => toast.error(message)}
      />

      <DeleteRecordDialog
        open={deleteOpen}
        record={selected}
        onClose={() => setDeleteOpen(false)}
        onDeleted={(name) => {
          toast.success(`Record ${name} deleted.`);
          setDeleteOpen(false);
          setSelected(null);
          refreshAll();
        }}
        onError={(message) => toast.error(message)}
      />

      <RecordDetailsDialog
        open={detailsOpen}
        record={selected}
        onClose={() => setDetailsOpen(false)}
      />
    </>
  );
}

/* ---------- create / edit record ---------- */

const TTL_PRESETS = [60, 300, 900, 3600, 86400];

function RecordFormDialog({
  open,
  zone,
  record,
  recordTypes,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean;
  zone: HostedZone | null;
  /** null means "create", a record means "edit". */
  record: DnsRecord | null;
  recordTypes: RecordType[];
  onClose: () => void;
  onSaved: (record: DnsRecord, wasEdit: boolean) => void;
  onError: (message: string) => void;
}) {
  const isEdit = record !== null;

  const [name, setName] = useState("");
  const [type, setType] = useState("A");
  const [ttl, setTtl] = useState(300);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (record && zone) {
      // Editing: show the part of the name the user typed, not the full domain.
      const suffix = `.${zone.name}`;
      setName(record.name === zone.name ? "" : record.name.replace(suffix, ""));
      setType(record.type);
      setTtl(record.ttl);
      setValue(record.values.join("\n"));
    } else {
      setName("");
      setType("A");
      setTtl(300);
      setValue("");
    }
    setError("");
  }, [open, record, zone]);

  const hint = recordTypes.find((entry) => entry.type === type)?.hint ?? "";

  async function submit() {
    if (!zone) return;
    setSaving(true);
    setError("");
    try {
      if (record) {
        const saved = await api.updateRecord(zone.id, record.id, {
          ttl,
          value,
          routing_policy: record.routing_policy,
        });
        onSaved(saved, true);
      } else {
        const saved = await api.createRecord(zone.id, {
          name,
          type,
          ttl,
          value,
          routing_policy: "Simple",
        });
        onSaved(saved, false);
      }
    } catch (problem) {
      const message = problem instanceof Error ? problem.message : "Could not save the record.";
      if (problem instanceof ApiError && (problem.status === 422 || problem.status === 409)) {
        setError(message);
      } else {
        onError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!zone) return null;

  return (
    <Modal
      title={isEdit ? `Edit ${record?.name}` : "Create record"}
      open={open}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={saving}>
            {isEdit ? "Save changes" : "Create record"}
          </Button>
        </>
      }
    >
      {error && <Alert kind="error">{error}</Alert>}

      <Field
        label="Record name"
        htmlFor="record-name"
        optional={!isEdit}
        hint={
          isEdit
            ? "A record's name and type identify it, so they cannot be changed. Delete and recreate it instead."
            : `Leave blank for ${zone.name} itself. Type "www" to get www.${zone.name}.`
        }
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            id="record-name"
            className="input"
            value={name}
            disabled={isEdit}
            autoFocus={!isEdit}
            placeholder="www"
            onChange={(event) => setName(event.target.value)}
          />
          <span className="muted nowrap">.{zone.name}</span>
        </div>
      </Field>

      <Field label="Record type" htmlFor="record-type" hint={hint}>
        <select
          id="record-type"
          className="select"
          value={type}
          disabled={isEdit}
          onChange={(event) => setType(event.target.value)}
        >
          {recordTypes.map((entry) => (
            <option key={entry.type} value={entry.type}>
              {entry.type}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Value"
        htmlFor="record-value"
        hint="One value per line. Most records have a single value."
      >
        <textarea
          id="record-value"
          className={error ? "textarea invalid" : "textarea"}
          value={value}
          autoFocus={isEdit}
          placeholder={hint.split("e.g. ")[1] ?? ""}
          onChange={(event) => setValue(event.target.value)}
        />
      </Field>

      <Field
        label="TTL (seconds)"
        htmlFor="record-ttl"
        hint="How long resolvers may cache this record before asking again."
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            id="record-ttl"
            className="input"
            type="number"
            min={0}
            style={{ width: 140 }}
            value={ttl}
            onChange={(event) => setTtl(Number(event.target.value))}
          />
          <div className="btn-row">
            {TTL_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={preset === ttl ? "badge badge-type" : "badge"}
                style={{ cursor: "pointer" }}
                onClick={() => setTtl(preset)}
              >
                {humanTtl(preset)}
              </button>
            ))}
          </div>
        </div>
      </Field>
    </Modal>
  );
}

/* ---------- delete record ---------- */

function DeleteRecordDialog({
  open,
  record,
  onClose,
  onDeleted,
  onError,
}: {
  open: boolean;
  record: DnsRecord | null;
  onClose: () => void;
  onDeleted: (name: string) => void;
  onError: (message: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  if (!record) return null;

  async function submit() {
    if (!record) return;
    setDeleting(true);
    try {
      await api.deleteRecord(record.zone_id, record.id);
      onDeleted(record.name);
    } catch (problem) {
      onError(problem instanceof Error ? problem.message : "Could not delete the record.");
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      title="Delete record?"
      open={open}
      onClose={onClose}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} loading={deleting}>
            Delete
          </Button>
        </>
      }
    >
      <Alert kind="error">This cannot be undone.</Alert>
      <p>
        You are about to delete the <strong>{record.type}</strong> record for{" "}
        <strong>{record.name}</strong>, which currently points to:
      </p>
      <div className="cell-values mono" style={{ marginBottom: 8 }}>
        {record.values.map((value, index) => (
          <span key={index}>{value}</span>
        ))}
      </div>
    </Modal>
  );
}

/* ---------- record details ---------- */

function RecordDetailsDialog({
  open,
  record,
  onClose,
}: {
  open: boolean;
  record: DnsRecord | null;
  onClose: () => void;
}) {
  if (!record) return null;

  return (
    <Modal
      title={record.name}
      open={open}
      onClose={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="kv-grid">
        <div>
          <div className="kv-label">Type</div>
          <div className="kv-value">
            <TypeBadge type={record.type} />
          </div>
        </div>
        <div>
          <div className="kv-label">TTL</div>
          <div className="kv-value">
            {record.ttl} seconds ({humanTtl(record.ttl)})
          </div>
        </div>
        <div>
          <div className="kv-label">Routing policy</div>
          <div className="kv-value">{record.routing_policy}</div>
        </div>
        <div>
          <div className="kv-label">Managed by Route 53</div>
          <div className="kv-value">{record.is_system ? "Yes" : "No"}</div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <div className="kv-label">Value</div>
          <div className="kv-value mono cell-values">
            {record.values.map((value, index) => (
              <span key={index}>{value}</span>
            ))}
          </div>
        </div>
        <div>
          <div className="kv-label">Created</div>
          <div className="kv-value">{formatDate(record.created_at)}</div>
        </div>
        <div>
          <div className="kv-label">Last updated</div>
          <div className="kv-value">{formatDate(record.updated_at)}</div>
        </div>
      </div>
    </Modal>
  );
}
