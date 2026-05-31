// Human-friendly "x ago" formatter for hub cards.
// Mirrors the mockup spec: secs / mins / hours / days / months / years ago.

const UNITS: Array<{ limit: number; secs: number; label: string }> = [
  { limit: 60, secs: 1, label: 'sec' },
  { limit: 3600, secs: 60, label: 'min' },
  { limit: 86400, secs: 3600, label: 'hour' },
  { limit: 2592000, secs: 86400, label: 'day' },
  { limit: 31536000, secs: 2592000, label: 'month' },
  { limit: Infinity, secs: 31536000, label: 'year' },
];

export function relativeTime(input?: string | number | Date | null): string {
  if (!input) return '';
  const then = new Date(input).getTime();
  if (Number.isNaN(then)) return '';

  const diffSecs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSecs < 5) return 'just now';

  for (const unit of UNITS) {
    if (diffSecs < unit.limit) {
      const value = Math.floor(diffSecs / unit.secs);
      return `${value} ${unit.label}${value === 1 ? '' : 's'} ago`;
    }
  }
  return '';
}
