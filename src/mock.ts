// The dev mock (CONTRACT.md section 9): a session over fixtures the app supplies, so app UIs
// can be built and checked without a portal or a sign-in. Its API answers the requests the
// kit itself makes, its file URLs are the fixture files' own, and datasets the app creates
// are kept in memory (their files as object URLs) and show up in later listings.
import type { Tag, UploadDatasetRequest } from '@cirrobio/api-client';
import { FILES_PROCESS_ID, ObjectStore } from './files';
import { ALL_APP_PERMISSIONS } from './permissions';
import { createSession } from './session';
import type { AppSession, MockFile, MockFixtures } from './types';

// A reserved name (RFC 2606): nothing the mock links to can reach a real host.
const MOCK_ORIGIN = 'https://mock.cirro.invalid';
const API_PATH = '/api';
const MOCK_BUCKET = 'mock';
const MOCK_REGION = 'us-west-2';
const MANIFEST_PAGE_SIZE = 20_000;
const DATASETS_PAGE_SIZE = 5000;
const CREDENTIAL_LIFETIME_MS = 3_600_000;
// The latest time a Date can hold: the mock's token never expires.
const NEVER = 8.64e15;

interface MockDatasetState {
  id: string;
  name: string;
  description: string;
  processId: string;
  createdAt: string;
  createdBy: string;
  tags: Tag[];
  files: MockFile[];
  status: 'COMPLETED' | 'PENDING';
  /** Files a dataset the app created still waits for; it completes when they have all arrived. */
  awaiting: string[];
}

interface MockProjectState {
  id: string;
  name: string;
  datasets: MockDatasetState[];
}

class NotFound extends Error {}

/**
 * A session over fixtures (mode `mock`), as `connectToCirro` makes for `?cirro-app=mock`.
 * Fixture ids must not contain `/`. Never point fixtures at real data.
 */
export function createMockSession(appId: string, fixtures: MockFixtures): AppSession {
  const user = { id: 'mock-user', email: 'mock.user@example.com', name: 'Mock User', ...fixtures.user };
  const { fetchApi, objects } = mockCirro(fixtures, user.id);
  const grant = { accessToken: 'mock-access-token', accessTokenExpiresAt: NEVER };
  return createSession({
    mode: 'mock',
    init: {
      app: { id: appId, name: fixtures.appName },
      user,
      tenant: { id: 'mock', name: 'Mock tenant', ...fixtures.tenant },
      apiBasePath: `${MOCK_ORIGIN}${API_PATH}`,
      portalOrigin: MOCK_ORIGIN,
      ...grant,
      permissions: fixtures.permissions ?? ALL_APP_PERMISSIONS,
      launch: fixtures.launch ?? {},
    },
    refreshToken: async () => grant,
    fetchApi,
    objects,
  });
}

function mockCirro(fixtures: MockFixtures, userId: string) {
  const startedAt = new Date().toISOString();
  let created = 0;
  const projects: MockProjectState[] = fixtures.projects.map((project) => ({
    id: project.id,
    name: project.name,
    datasets: project.datasets.map((dataset) => ({
      id: dataset.id,
      name: dataset.name,
      description: '',
      processId: dataset.processId ?? FILES_PROCESS_ID,
      createdAt: dataset.createdAt ?? startedAt,
      createdBy: userId,
      tags: structuredClone(dataset.tags ?? []),
      files: structuredClone(dataset.files),
      status: 'COMPLETED',
      awaiting: [],
    })),
  }));

  const findProject = (projectId: string): MockProjectState => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) throw new NotFound(`The mock has no project ${projectId}.`);
    return project;
  };
  const findDataset = (projectId: string, datasetId: string): MockDatasetState => {
    const dataset = findProject(projectId).datasets.find((d) => d.id === datasetId);
    if (!dataset) throw new NotFound(`The mock has no dataset ${datasetId} in project ${projectId}.`);
    return dataset;
  };
  // A dataset's files are at s3://mock/<projectId>/<datasetId>/<path>.
  const fromKey = (key: string) => {
    const [projectId, datasetId, ...path] = key.split('/');
    return { dataset: findDataset(projectId, datasetId), path: path.join('/') };
  };

  const projectJson = (project: MockProjectState) => ({
    id: project.id, name: project.name, description: '', status: 'COMPLETED', tags: [], organization: '', classificationIds: [],
    billingAccountId: '',
  });
  const datasetJson = (projectId: string, dataset: MockDatasetState) => ({
    id: dataset.id, name: dataset.name, description: dataset.description, projectId, processId: dataset.processId,
    sourceDatasetIds: [], status: dataset.status, tags: dataset.tags, createdBy: dataset.createdBy, createdAt: dataset.createdAt,
    updatedAt: dataset.createdAt,
  });

  const routes: Array<[string, RegExp, (ids: string[], query: URLSearchParams, body: unknown) => unknown]> = [
    ['GET', /^\/projects$/, () => projects.map(projectJson)],
    ['GET', /^\/projects\/([^/]+)$/, ([projectId]) => ({
      ...projectJson(findProject(projectId)), contacts: [], settings: null, account: null, statusMessage: '',
      createdBy: userId, createdAt: startedAt, updatedAt: startedAt,
    })],
    ['GET', /^\/projects\/([^/]+)\/datasets$/, ([projectId], query) => {
      const offset = Number(query.get('nextToken') ?? 0);
      const limit = Number(query.get('limit') ?? DATASETS_PAGE_SIZE);
      const all = findProject(projectId).datasets;
      return {
        data: all.slice(offset, offset + limit).map((dataset) => datasetJson(projectId, dataset)),
        nextToken: offset + limit < all.length ? String(offset + limit) : null,
      };
    }],
    ['POST', /^\/projects\/([^/]+)\/datasets\/upload$/, ([projectId], _query, body) => {
      const request = body as UploadDatasetRequest;
      const id = `mock-dataset-${++created}`;
      findProject(projectId).datasets.unshift({
        id, name: request.name, description: request.description ?? '', processId: request.processId,
        createdAt: new Date().toISOString(), createdBy: userId, tags: request.tags ?? [], files: [], status: 'PENDING',
        awaiting: [...request.expectedFiles],
      });
      return { id, message: 'Upload the expected files.', uploadPath: `${projectId}/${id}/data`, bucket: MOCK_BUCKET };
    }],
    ['GET', /^\/projects\/([^/]+)\/datasets\/([^/]+)$/, ([projectId, datasetId]) => {
      const dataset = findDataset(projectId, datasetId);
      return {
        ...datasetJson(projectId, dataset), s3: `s3://${MOCK_BUCKET}/${projectId}/${datasetId}`, sourceDatasets: [],
        sourceSampleIds: [], sourceSampleFilesMap: {}, statusMessage: '', params: {}, info: {}, share: null,
        isViewRestricted: false, totalSizeBytes: dataset.files.reduce((sum, file) => sum + (file.size ?? 0), 0),
        fileCount: dataset.files.length,
      };
    }],
    ['GET', /^\/projects\/([^/]+)\/datasets\/([^/]+)\/files$/, ([projectId, datasetId], query) => {
      const { files } = findDataset(projectId, datasetId);
      const offset = Number(query.get('fileOffset') ?? 0);
      const limit = Number(query.get('fileLimit') ?? MANIFEST_PAGE_SIZE);
      return {
        domain: `s3://${MOCK_BUCKET}/${projectId}/${datasetId}`,
        files: files.slice(offset, offset + limit).map((file) => ({ path: file.path, size: file.size, metadata: {} })),
        totalFiles: files.length,
      };
    }],
    ['POST', /^\/projects\/([^/]+)\/s3-token$/, ([projectId]) => {
      findProject(projectId);
      return {
        accessKeyId: 'mock', secretAccessKey: 'mock', sessionToken: 'mock', region: MOCK_REGION,
        expiration: new Date(Date.now() + CREDENTIAL_LIFETIME_MS).toISOString(),
      };
    }],
  ];

  const respond = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  async function fetchApi(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const path = url.pathname.slice(API_PATH.length);
    const method = (init.method ?? 'GET').toUpperCase();
    for (const [routeMethod, pattern, answer] of routes) {
      const match = pattern.exec(path);
      if (routeMethod !== method || !match) continue;
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      try {
        return respond(200, answer(match.slice(1).map(decodeURIComponent), url.searchParams, body));
      } catch (error) {
        if (error instanceof NotFound) return respond(404, { message: error.message });
        throw error;
      }
    }
    return respond(404, { message: `The Cirro mock does not answer ${method} ${path}.` });
  }

  const objects: ObjectStore = {
    async getUrl({ key }) {
      const { dataset, path } = fromKey(key);
      const file = dataset.files.find((f) => f.path === path);
      if (!file) throw new Error(`The mock dataset ${dataset.id} has no file ${path}.`);
      return file.url;
    },
    async put({ key }, _credentials, file) {
      const { dataset, path } = fromKey(key);
      const blob = file.body instanceof Blob ? file.body : new Blob([file.body], { type: file.contentType });
      dataset.files.push({ path, size: blob.size, url: URL.createObjectURL(blob) });
      dataset.awaiting = dataset.awaiting.filter((expected) => expected !== file.path);
      if (!dataset.awaiting.length) dataset.status = 'COMPLETED';
    },
  };

  return { fetchApi, objects };
}
