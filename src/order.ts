/**
 * An order for a gallery that grows while an index runs: a row keeps the place it was first
 * shown in, and rows found since are added after it, in `compare` order among themselves.
 * Re-sorting the whole list on every update would move cards under the user's pointer. Make
 * a new one each time the gallery opens, so its first rendering is fully sorted.
 */
export function createStableOrder<Row>(key: (row: Row) => string, compare: (a: Row, b: Row) => number): (rows: readonly Row[]) => Row[] {
  const rank = new Map<string, number>();
  return (rows) => {
    for (const row of rows.filter((r) => !rank.has(key(r))).sort(compare)) rank.set(key(row), rank.size);
    return [...rows].sort((a, b) => (rank.get(key(a)) ?? 0) - (rank.get(key(b)) ?? 0));
  };
}
