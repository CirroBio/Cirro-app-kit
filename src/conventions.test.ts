import { appFolderPath, appFolderTag, appSheetName, appTag, STANDARD_TABLES } from './conventions';

describe('appSheetName', () => {
  it('prefixes the app id and table', () => {
    expect(appSheetName('spatialdatastudio', 'file_list')).toBe('app_spatialdatastudio_file_list');
  });

  it.each([['spatial_data', 'history'], ['Proteoscope', 'history'], ['proteoscope', 'History'], ['proteoscope', '1st']])(
    'rejects %s / %s', (appId, table) => {
      expect(() => appSheetName(appId, table)).toThrow();
    });
});

describe('app folders', () => {
  it('roots folders at Apps/<App name>', () => {
    expect(appFolderPath('Spatial Data Studio', 'Views', ' 2026-10 ')).toBe('Apps/Spatial Data Studio/Views/2026-10');
    expect(appFolderTag('CytoWeave', 'Workspaces')).toEqual({ key: 'Folder', value: 'folder://Apps/CytoWeave/Workspaces', editable: true });
  });

  it('rejects segments the portal cannot show as folders', () => {
    expect(() => appFolderPath('CytoWeave', 'a/b')).toThrow();
    expect(() => appFolderPath('CytoWeave', 'x:y')).toThrow();
  });

  it('tags a dataset with its app', () => {
    expect(appTag('cytoweave')).toEqual({ key: 'App', value: 'cytoweave', editable: true });
  });
});

describe('standard tables', () => {
  it.each(STANDARD_TABLES.map((t) => [t.name, t] as const))('%s keys are columns and never user_id', (_name, table) => {
    const columns = Object.keys(table.columns);
    expect(columns).not.toContain('user_id');
    for (const key of table.key) expect(columns).toContain(key);
  });
});
