# Common Cirro response models (@cirrobio/api-client 0.13.37)

Field lists from the generated type declarations. `?` marks optional fields. Nested object fields shown as `{` are maps; open the .d.ts in `node_modules/@cirrobio/api-client/dist/models/` for their full shape.

- **Project**: `id: string`; `name: string`; `description: string`; `status: Status`; `tags: Array<Tag>`; `organization: string`; `classificationIds: Array<string>`; `billingAccountId: string`
- **ProjectDetail**: `id: string`; `name: string`; `description: string`; `billingAccountId: string`; `contacts: Array<Contact>`; `organization: string`; `status: Status`; `settings: ProjectSettings`; `account: CloudAccount`; `statusMessage: string`; `tags: Array<Tag>`; `classificationIds: Array<string>`; `deployedAt?: Date | null`; `deployedVersion?: string | null`; `createdBy: string`; `createdAt: Date`; `updatedAt: Date`
- **Dataset**: `id: string`; `name: string`; `description?: string`; `projectId: string`; `processId: string`; `sourceDatasetIds: Array<string>`; `status: Status`; `tags: Array<Tag>`; `createdBy: string`; `createdAt: Date`; `updatedAt: Date`
- **DatasetDetail**: `id: string`; `name: string`; `description?: string`; `s3: string`; `processId: string`; `projectId: string`; `originatingProjectId?: string`; `sourceDatasetIds: Array<string>`; `sourceDatasets: Array<NamedItem>`; `sourceSampleIds: Array<string>`; `sourceSampleFilesMap: {`; `status: Status`; `statusMessage: string`; `tags: Array<Tag>`; `params: {`; `info: {`; `share?: NamedItem | null`; `isViewRestricted: boolean`; `totalSizeBytes?: number | null`; `fileCount?: number | null`; `createdBy: string`; `createdAt: Date`; `updatedAt: Date`
- **DatasetAssetsManifest**: `domain?: string`; `files?: Array<FileEntry>`; `totalFiles?: number`; `viz?: Array<DatasetViz>`; `tables?: Array<Table>`; `artifacts?: Array<Artifact>`
- **AWSCredentials**: `accessKeyId: string`; `secretAccessKey: string`; `sessionToken: string`; `expiration: Date`; `region?: string`
- **ProjectFileAccessRequest**: `accessType: ProjectAccessType`; `datasetId?: string | null`; `sheetId?: string | null`; `tokenLifetimeHours?: number | null`
- **SystemInfoResponse**: `resourcesBucket: string`; `referencesBucket: string`; `liveEndpoint: string`; `agentEndpoint: string`; `region: string`; `systemMessage: string`; `maintenanceModeEnabled: boolean`; `backendVersion?: VersionInfo | null`; `resourcesVersion?: VersionInfo | null`; `projectResourceVersion?: VersionInfo | null`; `tenantInfo: TenantInfo`; `auth: AuthInfo`
- **AuthInfo**: `userPoolId: string`; `sdkAppId: string`; `uiAppId: string`; `driveAppId: string`; `endpoint: string`
- **TenantInfo**: `id: string`; `name: string`; `description: string`; `location: string`; `contactEmail: string`; `tenantLogoUrl: string`; `termsOfServiceUrl: string`; `privacyPolicyUrl: string`; `loginProviders: Array<LoginProvider>`; `features: FeatureFlags`
- **LoginProvider**: `id: string`; `name: string`; `description: string`; `logoUrl: string`
- **UserDetail**: `username: string`; `name: string`; `phone?: string | null`; `email: string`; `organization: string`; `orcidId?: string | null`; `jobTitle?: string | null`; `department?: string | null`; `invitedBy?: string | null`; `signUpTime?: Date | null`; `lastSignedIn?: Date | null`; `projectAssignments: Array<UserProjectAssignment>`; `globalRoles: Array<string>`; `groups?: Array<string> | null`; `settings: UserSettings`; `status: UserStatus`
- **PaginatedResponseDatasetListDto**: `data: Array<Dataset>`; `nextToken: string`

## Enums worth knowing

- **ProjectAccessType** (file credentials): `PROJECT_DOWNLOAD`, `SHARED_DATASET_DOWNLOAD`, `DATASET_UPLOAD`, `SAMPLESHEET_UPLOAD`, `REFERENCE_UPLOAD`, `SHEET_UPLOAD`, `READ_SCRATCH`. Only the two download types are cached by `FileService`; upload credentials are requested fresh each time.
- **AppType** (OAuth app registrations): `PUBLIC_APP` (front-end apps that act as the signed-in user — the only type this kit covers), `TRADITIONAL` and `MACHINE_TO_MACHINE` (registrations with a client secret; out of scope here).
