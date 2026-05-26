/**
 * PH 1.0-5.0 conversion table.
 * MUST match the server-side RPC `convert_percentage_to_numeric` in 0001_initial.sql.
 * If the university uses a different table, update BOTH places.
 */

export function percentageToNumeric(pct: number): number {
  if (pct >= 97) return 1.0;
  if (pct >= 94) return 1.25;
  if (pct >= 91) return 1.5;
  if (pct >= 88) return 1.75;
  if (pct >= 85) return 2.0;
  if (pct >= 84) return 2.25;
  if (pct >= 81) return 2.5;
  if (pct >= 78) return 2.75;
  if (pct >= 75) return 3.0;
  return 5.0;
}

export function numericToRemarks(numeric: number): 'Passed' | 'At Risk' | 'Failed' {
  if (numeric <= 3.0) return 'Passed';
  if (numeric < 5.0) return 'At Risk';
  return 'Failed';
}

export function percentageToRemarks(pct: number): 'Passed' | 'At Risk' | 'Failed' {
  if (pct >= 75) return 'Passed';
  if (pct >= 70) return 'At Risk';
  return 'Failed';
}

export function formatNumeric(n: number): string {
  return n.toFixed(2);
}
