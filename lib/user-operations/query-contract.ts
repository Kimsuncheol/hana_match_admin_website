import {
  DEFAULT_USER_FILTERS,
  type RestrictionFilter,
  type TrustFilter,
  type UserOperationsFilters,
  type UserStatusFilter,
  type VerificationFilter,
} from "./types";

const VERIFICATION = new Set<VerificationFilter>(["all", "verified", "unverified"]);
const STATUS = new Set<UserStatusFilter>(["all", "active", "disabled"]);
const RESTRICTION = new Set<RestrictionFilter>(["all", "restricted", "clear"]);
const TRUST = new Set<TrustFilter>(["all", "trusted", "watch", "risk"]);
const QUERY_PATTERN = /^(?:[^\s@]+@[^\s@]+\.[^\s@]+|[A-Za-z0-9:_-]{3,128})$/;

export function parseUserOperationsFilters(url: URL):
  | { ok: true; filters: UserOperationsFilters }
  | { ok: false; error: "invalid-query" } {
  const query = (url.searchParams.get("q") ?? "").trim();
  const verification = (url.searchParams.get("verification") ?? "all") as VerificationFilter;
  const status = (url.searchParams.get("status") ?? "all") as UserStatusFilter;
  const restriction = (url.searchParams.get("restriction") ?? "all") as RestrictionFilter;
  const trust = (url.searchParams.get("trust") ?? "all") as TrustFilter;
  const limit = Number(url.searchParams.get("limit") ?? DEFAULT_USER_FILTERS.limit);
  const cursor = url.searchParams.get("cursor") || undefined;

  if (
    (query !== "" && !QUERY_PATTERN.test(query)) ||
    !VERIFICATION.has(verification) ||
    !STATUS.has(status) ||
    !RESTRICTION.has(restriction) ||
    !TRUST.has(trust) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50 ||
    (cursor !== undefined && (cursor.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(cursor)))
  ) {
    return { ok: false, error: "invalid-query" };
  }

  return { ok: true, filters: { query, verification, status, restriction, trust, limit, cursor } };
}

