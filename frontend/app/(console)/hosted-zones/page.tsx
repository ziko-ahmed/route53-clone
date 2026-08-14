"use client";

/**
 * Hosted zones list -- the main page of the app.
 *
 * Search, filter, sort and pagination all happen on the backend; this page
 * just keeps the current query in state and re-fetches when it changes.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Column, DataTable } from "@/components/DataTable";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import { Alert, Button, Field, SearchBox, ZoneTypeBadge } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useToast } from "@/lib/toast";
import type { HostedZone } from "@/lib/types";
import { useDebounced } from "@/lib/useDebounced";
import { useShortcuts, type Shortcut } from "@/lib/useShortcuts";

export default function HostedZonesPage() {
  const toast = useToast();

  // --- what the user is looking at ---
  const [zones, setZones] = useState<HostedZone[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // --- query state ---
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput);
  const [typeFilter, setTypeFilter] = useState("");
  const [sort, setSort] = useState("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // --- selection and dialogs ---
  const searchRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<HostedZone | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await api.listZones({
        search,
        type: typeFilter,
        sort,
        order,
        page,
        page_size: pageSize,
      });
      setZones(result.items);
      setTotal(result.total);
      setTotalPages(result.total_pages);
    } catch (problem) {
      setLoadError(problem instanceof Error ? problem.message : "Could not load hosted zones.");
      setZones([]);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, sort, order, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  // Any change to the filters should put you back on page 1.
  useEffect(() => {
    setPage(1);
    setSelected(null);
  }, [search, typeFilter, pageSize]);

  const shortcuts = useMemo<Shortcut[]>(
    () => [
      { key: "/", description: "Focus search", run: () => searchRef.current?.focus() },
      { key: "c", description: "Create hosted zone", run: () => setCreateOpen(true) },
      { key: "r", description: "Refresh", run: () => load() },
    ],
    [load],
  );
  useShortcuts(shortcuts);

  function toggleSort(key: string) {
    if (key === sort) setOrder(order === "asc" ? "desc" : "asc");
    else {
      setSort(key);
      setOrder("asc");
    }
  }

  const columns: Column<HostedZone>[] = [
    {
      header: "Hosted zone name",
      sortKey: "name",
      cell: (zone) => <Link href={`/hosted-zones/${zone.id}`}>{zone.name}</Link>,
    },
    {
      header: "Type",
      cell: (zone) => <ZoneTypeBadge type={zone.type} />,
    },
    {
      header: "Created",
      sortKey: "created_at",
      nowrap: true,
      cell: (zone) => formatDate(zone.created_at),
    },
    {
      header: "Record count",
      sortKey: "record_count",
      cell: (zone) => zone.record_count,
    },
    {
      header: "Hosted zone ID",
      cell: (zone) => <span className="mono">{zone.id}</span>,
    },
    {
      header: "Description",
      cell: (zone) =>
        zone.comment ? zone.comment : <span className="cell-muted">-</span>,
    },
  ];

  return (
    <>
      <Breadcrumbs trail={[{ label: "Route 53", href: "/hosted-zones" }, { label: "Hosted zones" }]} />

      <div className="page-header">
        <div>
          <h1>Hosted zones</h1>
          <p className="page-description">
            A hosted zone holds the DNS records for one domain. Open a zone to add,
            edit or delete its records.
          </p>
        </div>
      </div>

      {loadError && <Alert kind="error">{loadError}</Alert>}

      <div className="container">
        <div className="container-header">
          <div className="container-title">
            <h2>
              Hosted zones <span className="counter">({total})</span>
            </h2>
          </div>
          <div className="btn-row">
            <Button onClick={load} title="Refresh the list">
              <Icon name="refresh" />
            </Button>
            <Button disabled={!selected} onClick={() => setDeleteOpen(true)} variant="danger">
              Delete zone
            </Button>
            <Button disabled={!selected} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="primary" onClick={() => setCreateOpen(true)} title="Shortcut: c">
              Create hosted zone
            </Button>
          </div>
        </div>

        <div className="toolbar">
          <SearchBox
            inputRef={searchRef}
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Find hosted zones by domain name"
          />
          <select
            className="select"
            style={{ width: "auto" }}
            value={typeFilter}
            aria-label="Filter by zone type"
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="">All types</option>
            <option value="Public">Public</option>
            <option value="Private">Private</option>
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
          rows={zones}
          columns={columns}
          rowKey={(zone) => zone.id}
          loading={loading}
          sort={sort}
          order={order}
          onSortChange={toggleSort}
          selection={{
            mode: "single",
            selected: selected?.id ?? null,
            onSelect: (zone) => setSelected(selected?.id === zone.id ? null : zone),
          }}
          empty={{
            title: search || typeFilter ? "No matching hosted zones" : "No hosted zones",
            description:
              search || typeFilter
                ? "Try a different search term or clear the filters."
                : "Create your first hosted zone to start adding DNS records.",
            action: (
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                Create hosted zone
              </Button>
            ),
          }}
        />

        {!loading && zones.length > 0 && (
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

      <CreateZoneDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(zone) => {
          toast.success(`Hosted zone ${zone.name} created.`);
          setCreateOpen(false);
          setSearchInput("");
          setTypeFilter("");
          load();
        }}
        onError={(message) => toast.error(message)}
      />

      <EditZoneDialog
        zone={selected}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(zone) => {
          toast.success(`Hosted zone ${zone.name} updated.`);
          setEditOpen(false);
          setSelected(null);
          load();
        }}
        onError={(message) => toast.error(message)}
      />

      <DeleteZoneDialog
        zone={selected}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={(name) => {
          toast.success(`Hosted zone ${name} deleted.`);
          setDeleteOpen(false);
          setSelected(null);
          load();
        }}
        onError={(message) => toast.error(message)}
      />
    </>
  );
}

/* ---------- create ---------- */

function CreateZoneDialog({
  open,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (zone: HostedZone) => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [type, setType] = useState("Public");
  const [fieldError, setFieldError] = useState("");
  const [saving, setSaving] = useState(false);

  // Start from a clean form every time the dialog opens.
  useEffect(() => {
    if (open) {
      setName("");
      setComment("");
      setType("Public");
      setFieldError("");
    }
  }, [open]);

  async function submit() {
    if (!name.trim()) {
      setFieldError("Enter a domain name.");
      return;
    }
    setSaving(true);
    setFieldError("");
    try {
      onCreated(await api.createZone({ name: name.trim(), comment, type }));
    } catch (problem) {
      const message = problem instanceof Error ? problem.message : "Could not create the zone.";
      // 422 is a problem with this field; anything else is a general failure.
      if (problem instanceof ApiError && (problem.status === 422 || problem.status === 409)) {
        setFieldError(message);
      } else {
        onError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Create hosted zone"
      open={open}
      onClose={onClose}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={saving}>
            Create hosted zone
          </Button>
        </>
      }
    >
      <Field
        label="Domain name"
        htmlFor="zone-name"
        hint="The domain this zone will hold records for, e.g. example.com."
        error={fieldError}
      >
        <input
          id="zone-name"
          className={fieldError ? "input invalid" : "input"}
          value={name}
          autoFocus
          placeholder="example.com"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && submit()}
        />
      </Field>

      <Field label="Description" htmlFor="zone-comment" optional>
        <input
          id="zone-comment"
          className="input"
          value={comment}
          placeholder="What is this zone for?"
          onChange={(event) => setComment(event.target.value)}
        />
      </Field>

      <Field
        label="Type"
        htmlFor="zone-type"
        hint="Public zones answer queries from the internet. Private zones answer only inside a VPC."
      >
        <select
          id="zone-type"
          className="select"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option value="Public">Public hosted zone</option>
          <option value="Private">Private hosted zone</option>
        </select>
      </Field>
    </Modal>
  );
}

/* ---------- edit ---------- */

function EditZoneDialog({
  zone,
  open,
  onClose,
  onSaved,
  onError,
}: {
  zone: HostedZone | null;
  open: boolean;
  onClose: () => void;
  onSaved: (zone: HostedZone) => void;
  onError: (message: string) => void;
}) {
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && zone) setComment(zone.comment);
  }, [open, zone]);

  if (!zone) return null;

  async function submit() {
    if (!zone) return;
    setSaving(true);
    try {
      onSaved(await api.updateZone(zone.id, comment));
    } catch (problem) {
      onError(problem instanceof Error ? problem.message : "Could not save the zone.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`Edit ${zone.name}`}
      open={open}
      onClose={onClose}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <p className="muted" style={{ marginTop: 0 }}>
        A zone&apos;s domain name and type are fixed once it exists, so only the
        description can be changed.
      </p>
      <Field label="Description" htmlFor="edit-comment" optional>
        <input
          id="edit-comment"
          className="input"
          value={comment}
          autoFocus
          onChange={(event) => setComment(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && submit()}
        />
      </Field>
    </Modal>
  );
}

/* ---------- delete ---------- */

function DeleteZoneDialog({
  zone,
  open,
  onClose,
  onDeleted,
  onError,
}: {
  zone: HostedZone | null;
  open: boolean;
  onClose: () => void;
  onDeleted: (name: string) => void;
  onError: (message: string) => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) setConfirmation("");
  }, [open]);

  if (!zone) return null;

  async function submit() {
    if (!zone) return;
    setDeleting(true);
    try {
      await api.deleteZone(zone.id);
      onDeleted(zone.name);
    } catch (problem) {
      onError(problem instanceof Error ? problem.message : "Could not delete the zone.");
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      title={`Delete ${zone.name}?`}
      open={open}
      onClose={onClose}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={submit}
            loading={deleting}
            disabled={confirmation !== "delete"}
          >
            Delete
          </Button>
        </>
      }
    >
      <Alert kind="error">
        Deleting a hosted zone cannot be undone. The zone must have no records left
        apart from the default NS and SOA records.
      </Alert>
      <Field label="Type delete to confirm" htmlFor="confirm-delete">
        <input
          id="confirm-delete"
          className="input"
          value={confirmation}
          autoFocus
          placeholder="delete"
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </Field>
    </Modal>
  );
}
