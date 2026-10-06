import { FILE_LIST_TABLE, SETTINGS_TABLE } from './conventions';
import { SheetStoreUnavailableError } from './errors';
import { createSheetStore, sheetInputFor } from './sheet-store';

describe('sheetInputFor', () => {
  it('maps a table to the sheet that would hold it, user_id first and key columns required', () => {
    expect(sheetInputFor('spatialdatastudio', FILE_LIST_TABLE)).toEqual({
      name: 'app_spatialdatastudio_file_list',
      namespaceName: 'default',
      tableName: 'app_spatialdatastudio_file_list',
      sheetType: 'TABLE',
      sheetCreationMode: 'SCRATCH',
      columns: [
        { name: 'user_id', dataType: 'STRING', required: true },
        { name: 'project_id', dataType: 'STRING', required: true },
        { name: 'project_name', dataType: 'STRING', required: false },
        { name: 'dataset_id', dataType: 'STRING', required: true },
        { name: 'dataset_name', dataType: 'STRING', required: false },
        { name: 'dataset_created_at', dataType: 'TIMESTAMP', required: false },
        { name: 'path', dataType: 'STRING', required: true },
        { name: 'is_folder', dataType: 'BOOLEAN', required: false },
        { name: 'kind', dataType: 'STRING', required: false },
        { name: 'label', dataType: 'STRING', required: false },
        { name: 'size', dataType: 'DOUBLE', required: false },
        { name: 'file_count', dataType: 'DOUBLE', required: false },
        { name: 'metadata', dataType: 'STRING', required: false },
        { name: 'indexed_at', dataType: 'TIMESTAMP', required: false }
      ],
    });
  });

  it('stores json as text', () => {
    expect(sheetInputFor('cytoweave', SETTINGS_TABLE).columns.find((c) => c.name === 'value')).toEqual({ name: 'value', dataType: 'STRING', required: false });
  });

  it('rejects names a sheet could not be parsed back from', () => {
    expect(() => sheetInputFor('spatial_data', SETTINGS_TABLE)).toThrow('Invalid app id');
  });
});

describe('the sheet store (stub)', () => {
  const store = createSheetStore('proteoscope');

  it('names its tables like the memory store', () => {
    expect(store.backend).toBe('sheets');
    expect(store.history.sheetName).toBe('app_proteoscope_history');
    expect(store.table(SETTINGS_TABLE)).toBe(store.settings);
  });

  it('fails every data method with SheetStoreUnavailableError', async () => {
    const { settings } = store;
    const row = { key: 'k', value: 1, updated_at: '2026-10-06T12:00:00Z' };
    for (const call of [settings.list(), settings.get({ key: 'k' }), settings.upsert(row), settings.upsertMany([row]), settings.remove({ key: 'k' })]) {
      await expect(call).rejects.toThrow(SheetStoreUnavailableError);
    }
    expect(() => settings.subscribe(() => undefined)).toThrow(SheetStoreUnavailableError);
  });
});
