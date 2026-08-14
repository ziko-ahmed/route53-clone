"use client";

/**
 * The small building blocks every page reuses: buttons, form fields,
 * badges, empty states and so on. Nothing here knows about DNS -- these
 * are generic pieces styled to look like the AWS console.
 */

import type { ReactNode, RefObject } from "react";

/* ---------- button ---------- */

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: "normal" | "primary" | "plain" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  block?: boolean;
  title?: string;
};

export function Button({
  children,
  onClick,
  variant = "normal",
  type = "button",
  disabled,
  loading,
  small,
  block,
  title,
}: ButtonProps) {
  const classes = [
    "btn",
    variant === "primary" ? "btn-primary" : "",
    variant === "plain" ? "btn-plain" : "",
    variant === "danger" ? "btn-danger" : "",
    small ? "btn-sm" : "",
    block ? "btn-block" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

/* ---------- form field ---------- */

export function Field({
  label,
  hint,
  error,
  optional,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>
        {label} {optional && <span className="field-optional">- optional</span>}
      </label>
      {hint && <div className="field-hint">{hint}</div>}
      {children}
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

/* ---------- badges ---------- */

export function TypeBadge({ type }: { type: string }) {
  return <span className="badge badge-type">{type}</span>;
}

export function ZoneTypeBadge({ type }: { type: string }) {
  const className = type === "Private" ? "badge badge-private" : "badge badge-public";
  return <span className={className}>{type}</span>;
}

/* ---------- empty state ---------- */

export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

/* ---------- loading placeholder ---------- */

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="skeleton-row" key={index}>
          <div className="skeleton-bar" style={{ width: `${45 + ((index * 13) % 40)}%` }} />
        </div>
      ))}
    </div>
  );
}

/* ---------- inline alert ---------- */

export function Alert({ children, kind = "info" }: { children: ReactNode; kind?: "info" | "error" }) {
  return (
    <div className={kind === "error" ? "alert alert-error" : "alert"} role="alert">
      <span aria-hidden="true">{kind === "error" ? "⚠" : "ℹ"}</span>
      <div>{children}</div>
    </div>
  );
}

/* ---------- search box ---------- */

export function SearchBox({
  value,
  onChange,
  placeholder,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Lets a page focus this box, e.g. from the "/" shortcut. */
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="search">
      <span className="search-icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="7" cy="7" r="5" />
          <line x1="11" y1="11" x2="15" y2="15" />
        </svg>
      </span>
      <input
        ref={inputRef}
        className="input"
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
