import { BookmarkRow, HISTORY_TABLE, SettingRow, STANDARD_TABLES, TableSchema } from './conventions';
import { createMemoryStore, MemoryTables } from './store';

const setting = (key: string, value: unknown): SettingRow => ({ key, value, updated_at: '2026-10-06T12:00:00.000Z' });

const bookmark = (id: string, overrides: Partial<BookmarkRow> = {}): BookmarkRow => ({
  id, created_at: '2026-10-06T12:00:00.000Z', title: `Bookmark ${id}`, note: null, project_id: 'p1', dataset_id: 'd1',
  path: 'data/a.cif', item_kind: 'structure', state: { camera: [0, 0, 1] }, ...overrides,
});

/** Lets listeners, which run as microtasks, see what happened. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the memory store', () => {
  it('has the five standard tables, named for the app', () => {
    const store = createMemoryStore('proteoscope', 'u1');
    expect(store.backend).toBe('memory');
    expect([store.history, store.bookmarks, store.settings, store.datasetsIndexed, store.fileList].map((t) => t.sheetName))
      .toEqual(STANDARD_TABLES.map((t) => `app_proteoscope_${t.name}`));
  });

  it('returns the same table for the same name', () => {
    const store = createMemoryStore('proteoscope', 'u1');
    expect(store.table(HISTORY_TABLE)).toBe(store.history);
    const views: TableSchema<{ id: string; camera: unknown }> = { name: 'views', columns: { id: 'string', camera: 'json' }, key: ['id'] };
    expect(store.table(views)).toBe(store.table({ ...views }));
  });

  it('rejects table names and schemas the sheet backend could not hold', () => {
    const store = createMemoryStore('proteoscope', 'u1');
    expect(() => store.table({ name: 'My Views', columns: { id: 'string' }, key: ['id'] })).toThrow('Invalid table name');
    expect(() => store.table({ name: 'owned', columns: { id: 'string', user_id: 'string' }, key: ['id'] })).toThrow('user_id');
    expect(() => store.table({ name: 'keyless', columns: { id: 'string' }, key: [] })).toThrow('key');
    expect(() => store.table({ name: 'stray', columns: { id: 'string' }, key: ['name' as 'id'] })).toThrow('key');
  });

  it('upserts by key, replacing the whole row in place', async () => {
    const { bookmarks } = createMemoryStore('proteoscope', 'u1');
    await bookmarks.upsertMany([bookmark('b1'), bookmark('b2')]);
    await bookmarks.upsert(bookmark('b1', { title: 'Renamed', note: 'kept for the figure' }));
    expect((await bookmarks.list()).map((b) => [b.id, b.title, b.note])).toEqual([['b1', 'Renamed', 'kept for the figure'], ['b2', 'Bookmark b2', null]]);
    await expect(bookmarks.get({ id: 'b2' })).resolves.toEqual(bookmark('b2'));
    await expect(bookmarks.get({ id: 'b3' })).resolves.toBeNull();
    await bookmarks.remove({ id: 'b1' });
    await bookmarks.remove({ id: 'b1' });
    expect((await bookmarks.list()).map((b) => b.id)).toEqual(['b2']);
  });

  it('keeps a composite key\'s rows apart', async () => {
    const { datasetsIndexed } = createMemoryStore('proteoscope', 'u1');
    const row = { project_id: 'p1', dataset_id: 'd1', dataset_name: 'D1', indexed_at: '2026-10-06T12:00:00Z', indexer_version: '1', item_count: 2, status: 'ok' as const, error: null };
    await datasetsIndexed.upsertMany([row, { ...row, project_id: 'p2' }, { ...row, item_count: 3 }]);
    expect((await datasetsIndexed.list()).map((r) => [r.project_id, r.item_count])).toEqual([['p1', 3], ['p2', 2]]);
  });

  it('partitions every table by user, and never shows user_id', async () => {
    const tables: MemoryTables = new Map();
    const alice = createMemoryStore('proteoscope', 'alice', tables);
    const bob = createMemoryStore('proteoscope', 'bob', tables);
    await alice.settings.upsert(setting('theme', 'dark'));
    await bob.settings.upsert(setting('theme', 'light'));
    await bob.settings.upsert(setting('units', 'nm'));
    expect(await alice.settings.list()).toEqual([setting('theme', 'dark')]);
    expect(await bob.settings.get({ key: 'theme' })).toEqual(setting('theme', 'light'));
    await alice.settings.remove({ key: 'units' });
    expect(await bob.settings.list()).toHaveLength(2);
    expect([...tables.get('app_proteoscope_settings')!.values()].map((row) => row.user_id)).toEqual(['alice', 'bob', 'bob']);
    expect(Object.keys((await alice.settings.list())[0])).not.toContain('user_id');
  });

  it('writes only the schema\'s columns, null when unset, and ignores a user_id the app passes', async () => {
    const tables: MemoryTables = new Map();
    const { settings } = createMemoryStore('proteoscope', 'u1', tables);
    await settings.upsert({ key: 'k', updated_at: '2026-10-06T12:00:00Z', extra: 1, user_id: 'someone-else' } as unknown as SettingRow);
    expect(await settings.list()).toEqual([{ key: 'k', value: null, updated_at: '2026-10-06T12:00:00Z' }]);
    expect([...tables.get('app_proteoscope_settings')!.values()][0].user_id).toBe('u1');
  });

  it('requires every key column', async () => {
    const { datasetsIndexed, settings } = createMemoryStore('proteoscope', 'u1');
    await expect(datasetsIndexed.get({ project_id: 'p1' })).rejects.toThrow('"dataset_id" is not set');
    await expect(datasetsIndexed.remove({ dataset_id: 'd1' })).rejects.toThrow('"project_id" is not set');
    await expect(settings.upsert({ value: 1, updated_at: '2026-10-06T12:00:00Z' } as SettingRow)).rejects.toThrow('"key" is not set');
  });

  it('checks column types, and writes nothing from a batch with a bad row', async () => {
    const { datasetsIndexed, settings } = createMemoryStore('proteoscope', 'u1');
    const row = { project_id: 'p1', dataset_id: 'd1', dataset_name: 'D1', indexed_at: '2026-10-06T12:00:00Z', indexer_version: '1', item_count: 2, status: 'ok' as const, error: null };
    await expect(datasetsIndexed.upsert({ ...row, item_count: '2' as unknown as number })).rejects.toThrow('datasets_indexed.item_count must be a number');
    await expect(datasetsIndexed.upsert({ ...row, item_count: NaN })).rejects.toThrow('must be a number');
    await expect(datasetsIndexed.upsert({ ...row, indexed_at: 'yesterday' })).rejects.toThrow('must be a timestamp');
    await expect(settings.upsert({ key: 'k', value: 1, updated_at: 'Tue Oct 06 2026' })).rejects.toThrow('must be a timestamp');
    await expect(datasetsIndexed.upsertMany([row, { ...row, dataset_id: 'd2', status: 3 as unknown as 'ok' }])).rejects.toThrow('must be a string');
    expect(await datasetsIndexed.list()).toEqual([]);
  });

  it('copies json values on the way in and out', async () => {
    const { bookmarks } = createMemoryStore('proteoscope', 'u1');
    const state = { camera: [0, 0, 1] };
    await bookmarks.upsert(bookmark('b1', { state }));
    state.camera.push(99);
    const read = (await bookmarks.get({ id: 'b1' }))!;
    expect(read.state).toEqual({ camera: [0, 0, 1] });
    (read.state as { camera: number[] }).camera.push(7);
    expect((await bookmarks.get({ id: 'b1' }))!.state).toEqual({ camera: [0, 0, 1] });
  });

  it('calls subscribers with every row at once and after every change, until they unsubscribe', async () => {
    const { settings } = createMemoryStore('proteoscope', 'u1');
    await settings.upsert(setting('a', 1));
    const calls: string[][] = [];
    const unsubscribe = settings.subscribe((rows) => calls.push(rows.map((r) => `${r.key}=${r.value}`)));
    expect(calls).toEqual([]);
    await settled();
    expect(calls).toEqual([['a=1']]);
    await settings.upsert(setting('b', 2));
    await settings.upsertMany([setting('a', 3), setting('c', 4)]);
    await settings.upsertMany([]);
    await settings.remove({ key: 'b' });
    await settings.remove({ key: 'missing' });
    await settled();
    expect(calls).toEqual([['a=1'], ['a=1', 'b=2'], ['a=3', 'b=2', 'c=4'], ['a=3', 'c=4']]);
    unsubscribe();
    await settings.upsert(setting('d', 5));
    await settled();
    expect(calls).toHaveLength(4);
  });

  it('gives each subscriber its own rows', async () => {
    const { bookmarks } = createMemoryStore('proteoscope', 'u1');
    await bookmarks.upsert(bookmark('b1'));
    const seen: unknown[] = [];
    bookmarks.subscribe((rows) => { (rows[0].state as { camera: number[] }).camera.push(1); });
    bookmarks.subscribe((rows) => seen.push(rows[0].state));
    await settled();
    expect(seen).toEqual([{ camera: [0, 0, 1] }]);
  });

  it('does not call a subscriber that left before its first call', async () => {
    const { settings } = createMemoryStore('proteoscope', 'u1');
    const listener = jest.fn();
    settings.subscribe(listener)();
    await settled();
    expect(listener).not.toHaveBeenCalled();
  });
});
