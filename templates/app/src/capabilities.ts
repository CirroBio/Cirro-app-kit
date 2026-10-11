import { ProjectRole, type UserDetail } from "@cirrobio/api-client";

// The app's own capabilities, derived from the user's role in a project.
// Keep every role check in this file. See docs/permissions.md.
export type Capability = "view" | "readFiles" | "addNotes" | "createDatasets" | "runPipelines";

// Example mapping. Cirro does not publish its role-to-permission table yet;
// confirm these with your Cirro admins, and treat a refused request as the final word.
const ROLE_CAPABILITIES: Record<ProjectRole, Capability[]> = {
  [ProjectRole.Owner]:        ["view", "readFiles", "addNotes", "createDatasets", "runPipelines"],
  [ProjectRole.Admin]:        ["view", "readFiles", "addNotes", "createDatasets", "runPipelines"],
  [ProjectRole.Contributor]:  ["view", "readFiles", "addNotes", "createDatasets", "runPipelines"],
  [ProjectRole.Collaborator]: ["view", "readFiles", "addNotes"],
  [ProjectRole.None]:         [],
};

export const roleIn = (user: UserDetail | undefined, projectId: string): ProjectRole =>
  user?.projectAssignments?.find((a) => a.projectId === projectId)?.role ?? ProjectRole.None;

export const can = (user: UserDetail | undefined, projectId: string, cap: Capability) =>
  ROLE_CAPABILITIES[roleIn(user, projectId)].includes(cap);
