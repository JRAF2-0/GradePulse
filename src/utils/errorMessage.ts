/**
 * Maps Postgres / Supabase / Auth errors to friendly user-facing text.
 *
 * Use everywhere we'd otherwise do `setError(err.message)` — the raw
 * message often exposes internal column names, RLS rules, or stack
 * fragments that confuse end users.
 */

interface MaybePostgrestError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  name?: string;
}

const PG_CODE_MAP: Record<string, string> = {
  '23503': 'This item is still in use elsewhere. Remove or reassign the dependents first.',
  '23505': 'That value is already taken. Please use a different one.',
  '23502': 'A required field is missing.',
  '23514': 'That value isn’t allowed by the rules of this field.',
  '42501':
    'You don’t have permission to do this. If you think this is a mistake, contact your admin.',
  '42P01': 'The requested resource doesn’t exist anymore.',
  PGRST116: 'No rows matched. The record may have been removed.',
  PGRST301: 'You don’t have permission to access this resource.',
};

const AUTH_MESSAGE_MAP: { match: RegExp; friendly: string }[] = [
  {
    match: /invalid login credentials|invalid_credentials/i,
    friendly: 'Wrong email or password. Please try again.',
  },
  {
    match: /email not confirmed|email_not_confirmed/i,
    friendly: 'Please confirm your email first. Check your inbox for a link.',
  },
  {
    match: /user already registered|already registered/i,
    friendly: 'An account with that email already exists. Try signing in instead.',
  },
  {
    match: /password should be at least/i,
    friendly: 'Password must be at least 6 characters.',
  },
  {
    match: /rate limit|too many/i,
    friendly: 'Too many attempts. Please wait a moment and try again.',
  },
  {
    match: /network|failed to fetch|networkerror/i,
    friendly: 'Network problem. Check your connection and try again.',
  },
];

/**
 * Domain-specific overrides for known business rules raised via `raise exception` in RPCs.
 */
const RPC_MESSAGE_MAP: { match: RegExp; friendly: string }[] = [
  { match: /invalid class code/i, friendly: 'That class code doesn’t match any active class.' },
  {
    match: /only students can join classes by code/i,
    friendly:
      'You need a student profile to join a class. Ask your admin to assign you the student role.',
  },
  {
    match: /cannot modify score for a finalized period/i,
    friendly: 'This period has been finalized. Scores can no longer be changed.',
  },
  {
    match: /only the class teacher or admin can finalize/i,
    friendly: 'Only the assigned teacher (or an admin) can finalize this period.',
  },
  {
    match: /admin access required|only admins/i,
    friendly: 'This action requires an admin account.',
  },
  {
    match: /weight.*100|sum.*weight/i,
    friendly: 'Category weights must total 100% per period before you can save scores.',
  },
];

export function humanizeError(err: unknown): string {
  if (err == null) return 'Something went wrong. Please try again.';

  if (typeof err === 'string') return err;

  if (typeof err === 'object') {
    const e = err as MaybePostgrestError;
    const msg = e.message ?? '';

    // 1. Map by Postgres error code (most specific)
    if (e.code && PG_CODE_MAP[e.code]) {
      return PG_CODE_MAP[e.code];
    }

    // 2. RPC business-rule messages (raised via `raise exception`)
    for (const { match, friendly } of RPC_MESSAGE_MAP) {
      if (match.test(msg)) return friendly;
    }

    // 3. Auth error patterns
    for (const { match, friendly } of AUTH_MESSAGE_MAP) {
      if (match.test(msg)) return friendly;
    }

    // 4. Fallback: capitalize the raw message
    if (msg) {
      return msg.charAt(0).toUpperCase() + msg.slice(1);
    }
  }

  return 'Something went wrong. Please try again.';
}
