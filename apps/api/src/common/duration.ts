/** Parses a short duration like "15m", "30d", "12h", "45s" into milliseconds.
 *  Used to align cookie maxAge with JWT TTLs. */
export function parseDurationMs(input: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/.exec(input.trim());
  if (!match) throw new Error(`Invalid duration: ${input}`);
  const value = Number(match[1]);
  const unit = match[2];
  const factor: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * factor[unit];
}
