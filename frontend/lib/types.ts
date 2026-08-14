// Shapes returned by the backend. These mirror backend/app/schemas.py.

export type User = {
  email: string;
  display_name: string;
  account_id: string;
};

export type HostedZone = {
  id: string;
  name: string;
  comment: string;
  type: "Public" | "Private";
  name_servers: string[];
  record_count: number;
  created_at: string;
};

export type DnsRecord = {
  id: number;
  zone_id: string;
  name: string;
  type: string;
  ttl: number;
  values: string[];
  routing_policy: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

export type RecordType = {
  type: string;
  hint: string;
};

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};
