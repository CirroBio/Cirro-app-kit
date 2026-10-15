# Cirro API surface (@cirrobio/api-client 0.13.38)

Generated from the package type declarations. Regenerate for the installed version with `python3 tools/api_surface.py <node_modules path>` before trusting a method name.

`data.X` means the getter on `new DataService(...)`. Methods take one object argument with the fields shown (`?` = optional) and return a Promise of the type shown.

## AppRegistrationsApi (not on DataService in this version)

- `approveApp({ id: string })` → `void`
- `archiveAppRegistration({ id: string })` → `void`
- `createAppRegistration({ appRegistrationInput: AppRegistrationInput })` → `AppRegistrationSecretResponse`
- `getAppRegistration({ id: string })` → `AppRegistrationDetail`
- `listAppRegistrationTemplates()` → `Array<AppRegistrationTemplate>`
- `listAppRegistrations({ limit?: number, nextToken?: string })` → `PaginatedResponseAppRegistrationDto`
- `listMyAppRegistrations()` → `Array<AppRegistration>`
- `regenerateSecret({ id: string })` → `AppRegistrationSecretResponse`
- `updateAppRegistration({ id: string, appRegistrationInput: AppRegistrationInput })` → `AppRegistrationDetail`

## AuditApi (`data.audit`)

- `getEvent({ auditEventId: string })` → `AuditEvent`
- `listEvents({ username?: string, entityType?: ListEventsEntityTypeEnum, entityId?: string, limit?: number, nextToken?: string })` → `PaginatedResponseAuditEventDto`

## BillingApi (`data.billing`)

- `createBillingAccount({ billingAccountRequest: BillingAccountRequest })` → `CreateResponse`
- `deleteBillingAccount({ billingAccountId: string })` → `void`
- `getBillingAccounts({ includeArchived?: boolean })` → `Array<BillingAccount>`
- `updateBillingAccount({ billingAccountId: string, billingAccountRequest: BillingAccountRequest })` → `void`

## ComputeEnvironmentApi (`data.computeEnvironments`)

- `createAgent({ agentInput: AgentInput })` → `CreateResponse`
- `createComputeEnvironment({ projectId: string, computeEnvironmentConfigurationInput: ComputeEnvironmentConfigurationInput })` → `CreateResponse`
- `deleteAgent({ agentId: string })` → `void`
- `deleteComputeEnvironment({ projectId: string, computeEnvironmentId: string })` → `void`
- `getAgents()` → `Array<AgentDetail>`
- `getComputeEnvironments({ projectId: string })` → `Array<ComputeEnvironmentConfiguration>`
- `updateAgent({ agentId: string, agentInput: AgentInput })` → `void`
- `updateComputeEnvironment({ projectId: string, computeEnvironmentId: string, computeEnvironmentConfigurationInput: ComputeEnvironmentConfigurationInput })` → `void`

## DashboardsApi (not on DataService in this version)

- `createDashboard({ projectId: string, dashboardInput: DashboardInput })` → `CreateResponse`
- `createDashboardTemplate({ dashboardInput: DashboardInput })` → `CreateResponse`
- `deleteDashboard({ projectId: string, dashboardId: string })` → `void`
- `deleteDashboardTemplate({ dashboardId: string })` → `void`
- `getDashboard({ projectId: string, dashboardId: string })` → `Dashboard`
- `getDashboardTemplate({ dashboardId: string })` → `Dashboard`
- `getDashboardTemplates()` → `Array<Dashboard>`
- `getDashboards({ projectId: string })` → `Array<Dashboard>`
- `updateDashboard({ projectId: string, dashboardId: string, dashboardInput: DashboardInput })` → `Dashboard`
- `updateDashboardTemplate({ dashboardId: string, dashboardInput: DashboardInput })` → `Dashboard`

## DatasetsApi (`data.datasets`)

- `deleteDataset({ projectId: string, datasetId: string })` → `void`
- `getDataset({ datasetId: string, projectId: string })` → `DatasetDetail`
- `getDatasetManifest({ datasetId: string, projectId: string, fileOffset?: number, fileLimit?: number })` → `DatasetAssetsManifest`
- `getDatasets({ projectId: string, limit?: number, nextToken?: string })` → `PaginatedResponseDatasetListDto`
- `getSampleSheets({ projectId: string, datasetId: string })` → `SampleSheets`
- `importPublicDataset({ projectId: string, importDataRequest: ImportDataRequest })` → `CreateResponse`
- `ingestSamples({ projectId: string, datasetId: string })` → `void`
- `regenerateManifest({ projectId: string, datasetId: string })` → `void`
- `rerunTransform({ projectId: string, datasetId: string })` → `void`
- `updateDataset({ projectId: string, datasetId: string, updateDatasetRequest: UpdateDatasetRequest })` → `DatasetDetail`
- `uploadDataset({ projectId: string, uploadDatasetRequest: UploadDatasetRequest })` → `UploadDatasetCreateResponse`

## ExecutionApi (`data.execution`)

- `calculateCost({ projectId: string, datasetId: string })` → `CostResponse`
- `getExecutionLogs({ datasetId: string, projectId: string, forceLive?: boolean })` → `GetExecutionLogsResponse`
- `getTask({ datasetId: string, projectId: string, taskId: string, forceLive?: boolean })` → `Task`
- `getTaskFiles({ datasetId: string, projectId: string, taskId: string })` → `GetTaskFilesResponse`
- `getTaskLineage({ datasetId: string, projectId: string, taskId: string })` → `GetTaskLineageResponse`
- `getTaskLogs({ datasetId: string, projectId: string, taskId: string, forceLive?: boolean, source?: TaskLogSource })` → `GetExecutionLogsResponse`
- `getTasksForExecution({ datasetId: string, projectId: string, forceLive?: boolean })` → `Array<Task>`
- `runAnalysis({ projectId: string, runAnalysisRequest: RunAnalysisRequest })` → `CreateResponse`
- `stopAnalysis({ datasetId: string, projectId: string })` → `StopExecutionResponse`

## FeedApi (not on DataService in this version)

- `createDiscussion({ discussionInput: DiscussionInput })` → `Discussion`
- `deleteDiscussion({ discussionId: string })` → `void`
- `deleteMessage({ discussionId: string, messageId: string })` → `void`
- `getDiscussion({ discussionId: string })` → `Discussion`
- `getDiscussionsForEntity({ entityType: EntityType, entityId: string, nextToken?: string | null, limit?: number, order?: SortOrder | null })` → `PaginatedResponseDiscussion`
- `getMessagesForDiscussion({ discussionId: string, nextToken?: string | null, limit?: number, threadId?: string | null, order?: SortOrder | null })` → `PaginatedResponseMessage`
- `postMessage({ discussionId: string, messageInput: MessageInput })` → `void`
- `updateDiscussion({ discussionId: string, discussionInput: DiscussionInput })` → `void`
- `updateMessage({ discussionId: string, messageId: string, messageInput: MessageInput })` → `void`

## FileApi (`data.file`)

- `generateGovernanceFileAccessToken({ requirementId: string, governanceFileAccessRequest: GovernanceFileAccessRequest })` → `AWSCredentials`
- `generateProjectFileAccessToken({ projectId: string, projectFileAccessRequest: ProjectFileAccessRequest })` → `AWSCredentials`
- `generateProjectSftpToken({ projectId: string, generateSftpCredentialsRequest: GenerateSftpCredentialsRequest })` → `SftpCredentials`
- `getProjectFile({ projectId: string, datasetId: string })` → `ProjectFile`
- `queryProjectFiles({ projectId: string, source?: DatasetSource | null, fileType?: string | null, datasetId?: string | null, processId?: string | null, createdBy?: string | null, pathContains?: string | null, minSize?: number | null, maxSize?: number | null, createdAfter?: Date | null, createdBefore?: Date | null, sortOrder?: SqlSortOrder | null, limit?: number | null, nextToken?: string | null })` → `ProjectFileQueryResponse`

## GovernanceApi (`data.governance`)

- `createClassification({ classificationInput: ClassificationInput })` → `GovernanceClassification`
- `createContact({ contactInput: ContactInput })` → `GovernanceContact`
- `createRequirement({ requirementInput: RequirementInput })` → `GovernanceRequirement`
- `deleteClassification({ classificationId: string })` → `void`
- `deleteContact({ contactId: string })` → `void`
- `deleteRequirement({ requirementId: string })` → `void`
- `fulfillRequirement({ projectId: string, requirementId: string, requirementFulfillmentInput: RequirementFulfillmentInput })` → `FulfillmentResponse`
- `getClassification({ classificationId: string })` → `GovernanceClassification`
- `getClassifications()` → `Array<GovernanceClassification>`
- `getContact({ contactId: string })` → `GovernanceContact`
- `getContacts()` → `Array<GovernanceContact>`
- `getRequirement({ requirementId: string })` → `GovernanceRequirement`
- `getRequirements({ projectId?: string })` → `Array<GovernanceRequirement>`
- `getRequirementsByProject({ projectId: string, username?: string })` → `Array<ProjectRequirement>`
- `updateClassification({ classificationId: string, classificationInput: ClassificationInput })` → `GovernanceClassification`
- `updateContact({ contactId: string, contactInput: ContactInput })` → `GovernanceContact`
- `updateRequirement({ requirementId: string, requirementInput: RequirementInput })` → `GovernanceRequirement`
- `updateRequirementFileForProject({ requirementId: string, projectId: string, governanceFileInput: GovernanceFileInput })` → `void`

## MetadataApi (`data.metadata`)

- `getDatasetSamples({ projectId: string, datasetId: string })` → `Array<Sample>`
- `getProjectSamples({ projectId: string, limit?: number, nextToken?: string })` → `PaginatedResponseSampleDto`
- `getProjectSchema({ projectId: string })` → `FormSchema`
- `getSampleById({ projectId: string, sampleId: string })` → `Sample`
- `updateProjectSchema({ projectId: string, formSchema: FormSchema })` → `void`
- `updateSample({ projectId: string, sampleId: string, sampleRequest: SampleRequest })` → `Sample`

## MetricsApi (not on DataService in this version)

- `getAllMetrics()` → `Array<ProjectMetrics>`
- `getMetricsSummary()` → `TenantMetrics`
- `getProjectMetrics({ projectId: string })` → `ProjectMetrics`

## ProcessesApi (`data.processes`)

- `archiveCustomProcess({ processId: string })` → `void`
- `calculatePipelineCost({ processId: string, body: object })` → `PipelineCost`
- `createCustomProcess({ customProcessInput: CustomProcessInput })` → `CreateResponse`
- `getLatestProcessRevision({ processId: string })` → `ProcessRevision`
- `getProcess({ processId: string })` → `ProcessDetail`
- `getProcessDocumentation({ processId: string })` → `ProcessDocumentation`
- `getProcessParameters({ processId: string })` → `ProcessParameterSchema`
- `getProcessResource({ processId: string, type: ProcessResource })` → `ProcessResourceContent`
- `getProcessRevision({ processId: string, revisionNum: number })` → `ProcessRevision`
- `getProcesses({ includeArchived?: boolean })` → `Array<Process>`
- `listProcessRevisions({ processId: string, limit?: number, nextToken?: string })` → `PaginatedResponseProcessRevisionDto`
- `saveProcessRevision({ processId: string, processRevisionSaveRequest: ProcessRevisionSaveRequest, ifMatch?: string | null })` → `ProcessRevisionSaveResponse`
- `syncCustomProcess({ processId: string })` → `CustomPipelineSettings`
- `updateCustomProcess({ processId: string, customProcessInput: CustomProcessInput })` → `void`
- `validateFileNamePatterns({ processId: string, validateFileNamePatternsRequest: ValidateFileNamePatternsRequest })` → `Array<FileNameMatch>`
- `validateFileRequirements({ processId: string, validateFileRequirementsRequest: ValidateFileRequirementsRequest })` → `FileRequirements`

## ProjectRequestsApi (`data.projectRequests`)

- `createProjectRequest({ projectRequest: ProjectRequest })` → `CreateResponse`

## ProjectsApi (`data.projects`)

- `approveAccessRequest({ projectId: string, accessRequestId: string, approveProjectAccessRequest: ApproveProjectAccessRequest })` → `void`
- `archiveProject({ projectId: string })` → `void`
- `createAccessRequest({ projectId: string, createProjectAccessRequest: CreateProjectAccessRequest })` → `CreateResponse`
- `createProject({ projectInput: ProjectInput })` → `CreateResponse`
- `denyAccessRequest({ projectId: string, accessRequestId: string })` → `void`
- `getAccessRequests({ projectId: string, includeClosed?: boolean })` → `Array<ProjectAccessRequest>`
- `getDiscoverableProjects()` → `Array<Project>`
- `getProject({ projectId: string })` → `ProjectDetail`
- `getProjectCreateOptions()` → `ProjectCreateOptions`
- `getProjectUsers({ projectId: string })` → `Array<ProjectUser>`
- `getProjects()` → `Array<Project>`
- `getQuotas({ projectId: string })` → `Array<CloudQuota>`
- `redeployProject({ projectId: string })` → `void`
- `requestQuotaIncrease({ projectId: string, requestQuotaIncreaseCommand: RequestQuotaIncreaseCommand })` → `RequestQuotaIncreaseResponse`
- `setUserProjectRole({ projectId: string, setUserProjectRoleRequest: SetUserProjectRoleRequest })` → `void`
- `unarchiveProject({ projectId: string })` → `void`
- `updateProject({ projectId: string, projectInput: ProjectInput })` → `ProjectDetail`
- `updateProjectTags({ projectId: string, tag: Array<Tag> })` → `void`

## ReferencesApi (`data.references`)

- `createProjectReference({ projectId: string, createReferenceRequest: CreateReferenceRequest })` → `Reference`
- `deleteProjectReference({ projectId: string })` → `void`
- `getReferenceTypes()` → `Array<ReferenceType>`
- `getReferences()` → `Array<Reference>`
- `getReferencesForProject({ projectId: string })` → `Array<Reference>`
- `refreshProjectReferences({ projectId: string })` → `void`

## SharedFilesystemsApi (not on DataService in this version)

- `createSharedFilesystem({ projectId: string, sharedFilesystemInput: SharedFilesystemInput })` → `CreateResponse`
- `deleteSharedFilesystem({ projectId: string, filesystemId: string })` → `void`
- `getSharedFilesystem({ projectId: string, filesystemId: string })` → `SharedFilesystem`
- `listSharedFilesystems({ projectId: string })` → `Array<SharedFilesystem>`
- `updateSharedFilesystem({ projectId: string, filesystemId: string, sharedFilesystemInput: SharedFilesystemInput })` → `SharedFilesystem`

## SharingApi (`data.sharing`)

- `createShare({ projectId: string, shareInput: ShareInput })` → `CreateResponse`
- `deleteShare({ projectId: string, shareId: string })` → `void`
- `getDiscoverableShares({ projectId: string })` → `Array<Share>`
- `getShare({ projectId: string, shareId: string })` → `ShareDetail`
- `getShareUsages({ projectId: string, shareId: string, limit?: number, nextToken?: string })` → `PaginatedResponseShareUsage`
- `getSharedDatasets({ projectId: string, shareId: string, limit?: number, nextToken?: string })` → `PaginatedResponseDatasetListDto`
- `getShares({ projectId: string })` → `Array<Share>`
- `revokeShareUsage({ projectId: string, shareId: string, usageId: string })` → `void`
- `subscribeShare({ projectId: string, shareId: string })` → `void`
- `unsubscribeShare({ projectId: string, shareId: string })` → `void`
- `updateShare({ projectId: string, shareId: string, shareInput: ShareInput })` → `void`

## SheetsApi (not on DataService in this version)

- `createSheet({ projectId: string, sheetInput: SheetInput })` → `CreateResponse`
- `deleteSheet({ projectId: string, sheetId: string })` → `void`
- `deleteSheetData({ projectId: string, sheetId: string, deleteRowsRequest: DeleteRowsRequest })` → `SheetDataUpdateResponse`
- `deleteSheetMapping({ projectId: string, sheetId: string, targetType: EntityType, targetId: string })` → `void`
- `getJobs({ projectId: string, sheetId: string })` → `Array<SheetJob>`
- `getSheet({ projectId: string, sheetId: string })` → `SheetDetail`
- `getSheetData({ projectId: string, sheetId: string, limit?: number, page?: number, orderBy?: string | null, order?: SqlSortOrder })` → `SheetQueryResponse`
- `getSheetMapping({ projectId: string, sheetId: string, targetType: EntityType, targetId: string })` → `TargetMapping`
- `getSheetMappings({ projectId: string, sheetId: string })` → `Array<TargetMapping>`
- `getSheets({ projectId: string })` → `Array<Sheet>`
- `insertSheetData({ projectId: string, sheetId: string, insertRowsRequest: InsertRowsRequest })` → `SheetDataUpdateResponse`
- `queryData({ projectId: string, sheetQueryRequest: SheetQueryRequest })` → `SheetQueryResponse`
- `querySheetData({ projectId: string, sheetId: string, sheetDataRequest: SheetDataRequest })` → `SheetQueryResponse`
- `refreshView({ projectId: string, sheetId: string })` → `void`
- `saveSheetMapping({ projectId: string, sheetId: string, targetType: EntityType, targetId: string, targetMappingInput: TargetMappingInput })` → `TargetMapping`
- `triggerIngest({ projectId: string, sheetId: string, sheetIngestRequest: SheetIngestRequest })` → `void`
- `updateSheet({ projectId: string, sheetId: string, sheetInput: SheetInput, dryRun?: boolean })` → `SheetUpdateResponse`
- `updateSheetData({ projectId: string, sheetId: string, updateRowsRequest: UpdateRowsRequest })` → `SheetDataUpdateResponse`

## SystemApi (`data.system`)

- `getServiceConnections()` → `Array<ServiceConnection>`
- `info()` → `SystemInfoResponse`

## ToolsApi (`data.tools`)

- `moveDataset({ moveDatasetInput: MoveDatasetInput })` → `MoveDatasetResponse`

## UsersApi (`data.users`)

- `activateUser({ username: string })` → `void`
- `deactivateUser({ username: string, removeFromProjects?: boolean })` → `void`
- `getUser({ username: string })` → `UserDetail`
- `inviteUser({ inviteUserRequest: InviteUserRequest })` → `InviteUserResponse`
- `listUsers({ username?: string | null, limit?: number, nextToken?: string })` → `PaginatedResponseUserDto`
- `signOutUser({ username: string })` → `void`
- `updateUser({ username: string, updateUserRequest: UpdateUserRequest })` → `User`

## WorkspacesApi (`data.workspaces`)

- `connectWorkspace({ projectId: string, workspaceId: string })` → `WorkspaceConnectionResponse`
- `createWorkspace({ projectId: string, workspaceInput: WorkspaceInput })` → `CreateResponse`
- `deleteWorkspace({ projectId: string, workspaceId: string, force?: boolean })` → `void`
- `disconnectWorkspace({ projectId: string, workspaceId: string, sessionId: string })` → `void`
- `getWorkspace({ projectId: string, workspaceId: string })` → `Workspace`
- `getWorkspaceEnvironments()` → `Array<WorkspaceEnvironment>`
- `getWorkspaceLogs({ projectId: string, workspaceId: string })` → `Array<LogEntry>`
- `getWorkspaces({ projectId: string })` → `Array<Workspace>`
- `postponeAutoStop({ projectId: string, workspaceId: string, postponeWorkspaceAutostopInput: PostponeWorkspaceAutostopInput })` → `Workspace`
- `startWorkspace({ projectId: string, workspaceId: string })` → `void`
- `stopWorkspace({ projectId: string, workspaceId: string })` → `void`
- `updateWorkspace({ projectId: string, workspaceId: string, workspaceInput: WorkspaceInput })` → `void`

