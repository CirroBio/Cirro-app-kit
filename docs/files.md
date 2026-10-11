# Working with files

## How it works

1. The app describes what it wants to access with a `ProjectFileAccessContext`.
2. `FileService` calls `FileApi.generateProjectFileAccessToken({ projectId, projectFileAccessRequest })`, which returns `AWSCredentials` (`accessKeyId`, `secretAccessKey`, `sessionToken`, `expiration`, `region`). These are short-lived STS credentials scoped to one project (or one shared dataset).
3. The SDK signs an S3 GET URL locally with those credentials (`getSignedUrl`, default expiry 5 minutes) and the browser fetches from S3 directly.

Download credentials (`PROJECT_DOWNLOAD`, `SHARED_DATASET_DOWNLOAD`) are cached per project (per project + dataset for shared datasets) until `expiration`, behind a mutex so parallel reads share one request. Upload credentials are not cached.

## Access contexts

```typescript
import { ProjectFileAccessContext } from "@cirrobio/sdk";

ProjectFileAccessContext.datasetDownload(project, dataset); // picks SHARED_DATASET_DOWNLOAD if dataset.share is set
ProjectFileAccessContext.projectDownload(project);          // any file in the project
new ProjectFileAccessContext(project, dataset, { accessType: ProjectAccessType.DatasetUpload, datasetId }); // uploads and other types
```

`project` only needs `{ id }`. `dataset` must be a `DatasetDetail` (from `getDataset`), because the context reads `dataset.share`.

## Listing a dataset's files

```typescript
import { ManifestParser } from "@cirrobio/sdk";

const manifest = await data.datasets.getDatasetManifest({ projectId, datasetId });
const assets = new ManifestParser(manifest, ctx).generateAssets();   // pass true to include folder entries
assets.totalSize;            // human-readable, e.g. "1.2 GB"
assets[0].name; assets[0].path; assets[0].size; assets[0].kind; assets[0].url;  // url is s3://...
```

The manifest also carries `viz`, `tables` and `artifacts` for datasets that produce them, and a `domain` for the bucket. Prefer `manifest.domain` over `getProjectS3Bucket(projectId)`, which the SDK marks for deprecation.

## Reading

| Need | Call |
| --- | --- |
| Response for a listed file | `files.getProjectFile(file, options?)` |
| Signed URL for a listed file | `files.getSignedUrlFromProjectFile(file, options?)` |
| Signed URL for a known path in the project | `files.getSignedUrlFromProjectPath(ctx, "data/out/summary.csv", options?)` |
| Raw credentials for another library | `files.getProjectAccessCredentials(ctx)` |

Signing options: `download` (sets a Content-Disposition filename), `filename`, `gzip` (requests gzip encoding), `timeout` (minutes), `region`.

File credentials:

- `FileService` caches project read credentials per instance, so create one per app (as `DataService` is), not one per component.
- `/projects/{id}/s3-token` can answer 429 when several requests arrive at once. This was seen on dev.cirro.bio with several apps signed in as one user. Retry 429s with backoff.

`FileSystemObject`s from `ManifestParser` carry `path`, which is the file's **folder**, and `relativePath`, which is the file's path within the dataset. Match files on `relativePath`; matching on `path` silently finds nothing.

Reading part of a large file (a `.zarr.zip`, `.h5ad`, BAM) by range from a signed URL:

- Don't send HEAD: the presigned URL is for GET only, and HEAD is refused. Take the file's length from the dataset manifest, or from the `Content-Range` of a `bytes=0-0` GET.
- Expect 206 for every ranged read.
- On 401 or 403, the URL has expired. Re-sign once, shared by all in-flight reads, and retry.

For libraries that fetch by path or with range requests (Zarr, OME-TIFF, genome tracks), signing each URL yourself is impractical. [Viewers](viewers.md#libraries-that-fetch-files-themselves) covers the three approaches: `patchFetch` for libraries that use `fetch`, a function-valued URL for igv.js, and a fetch override for `@gmod` readers. Outside `ViewerProvider`, give the library a custom fetch or URL resolver that calls `getSignedUrlFromProjectPath` per request.

## Uploading

Uploading a new dataset is two steps: create the dataset record, which returns where to put the files, then upload each file there.

```typescript
import { uploadFile, ProjectFileAccessContext } from "@cirrobio/sdk";
import { ProjectAccessType } from "@cirrobio/api-client";

// 1. Create the dataset; expectedFiles lists the relative paths you will upload
const created = await data.datasets.uploadDataset({
  projectId: project.id,
  uploadDatasetRequest: { name, description, processId, expectedFiles: fileList.map(f => f.name),
                          tags: [{ key: "cirro-app", value: APP_ID }] },
});  // → { id, message, uploadPath, bucket }

// 2. Get upload credentials for that dataset and upload each file under uploadPath.
//    The context takes the dataset's detail (non-null in sdk 0.13.37), so fetch it.
const dataset = await data.datasets.getDataset({ projectId: project.id, datasetId: created.id });
const ctx = new ProjectFileAccessContext(project, dataset, { accessType: ProjectAccessType.DatasetUpload, datasetId: created.id });
const credentials = await files.getProjectAccessCredentials(ctx);
for (const file of fileList) {
  const upload = uploadFile({ bucket: created.bucket, path: `${created.uploadPath}/${file.name}`, file, credentials });
  upload.on("httpUploadProgress", (p) => setProgress(file.name, p.loaded / (p.total ?? file.size)));
  await upload.done();
}
```

`processId` is the ingest process for the data type being uploaded; list options with `data.processes` (see the [API reference](../reference/api-surface.md)). `uploadFile` returns an AWS `Upload` (multipart, 4 parts in parallel). Check how `uploadPath` is formatted (trailing slash or not) on the first real response before joining paths.

## Pitfalls

- **Expired URLs.** Store `FileSystemObject`s, sign at the moment of use. Raise `timeout` only for long streaming reads.
- **CORS.** S3 enforces the bucket's CORS policy against the page origin. A CORS failure on file reads while API calls succeed means the origin isn't allowed on the bucket; it needs a Cirro admin to fix.
- **Credential hygiene.** The credentials are real AWS keys. Keep them in memory; don't log request URLs that contain signatures.
- **Wrong context type.** Using `projectDownload` for a dataset shared from another project fails with 403; use `datasetDownload(project, datasetDetail)`.
