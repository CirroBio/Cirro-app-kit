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

For libraries that fetch by path or with range requests (igv.js indexes, Zarr, OME-TIFF), signing each URL yourself is impractical. In a `ViewerProvider` tool, turn on `patchFetch` and pass `getPatchedSignUrl(s3Url)` to the library (see [viewers](viewers.md#libraries-that-fetch-files-themselves)). Outside `ViewerProvider`, give the library a custom fetch or URL resolver that calls `getSignedUrlFromProjectPath` per request.

## Uploading

Uploading a new dataset is two steps: create the dataset record, which returns where to put the files, then upload each file there.

```typescript
import { uploadFile, ProjectFileAccessContext } from "@cirrobio/sdk";
import { ProjectAccessType } from "@cirrobio/api-client";

// 1. Create the dataset; expectedFiles lists the relative paths you will upload
const created = await data.datasets.uploadDataset({
  projectId: project.id,
  uploadDatasetRequest: { name, description, processId, expectedFiles: fileList.map(f => f.name) },
});  // → { id, message, uploadPath, bucket }

// 2. Get upload credentials for that dataset and upload each file under uploadPath
const ctx = new ProjectFileAccessContext(project, null, { accessType: ProjectAccessType.DatasetUpload, datasetId: created.id });
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
