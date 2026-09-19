/**
 * Format a millisecond duration for compact trace labels.
 *
 * @example
 * formatMilliseconds(264); // "264ms"
 * formatMilliseconds(4_623); // "4.6s"
 */
export function formatMilliseconds(milliseconds: number): string {
  return milliseconds < 1_000
    ? `${Math.round(milliseconds)}ms`
    : `${(milliseconds / 1_000).toFixed(1)}s`;
}
