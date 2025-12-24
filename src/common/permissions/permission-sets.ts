import { Permission } from './permissions.enum'

/**
 * Permission sets for different roles
 * Each role has a predefined set of permissions
 */
export const PermissionSets = {
  /**
   * Super Admin - all permissions, system-wide access
   */
  SUPERADMIN: [
    // All permissions
    ...Object.values(Permission),
  ],

  /**
   * Workspace Owner - full access to everything
   */
  WORKSPACE_OWNER: [
    // Workspace
    Permission.WORKSPACE_VIEW,
    Permission.WORKSPACE_UPDATE,
    Permission.WORKSPACE_DELETE,
    Permission.WORKSPACE_MANAGE_MEMBERS,
    Permission.WORKSPACE_MANAGE_SETTINGS,
    // Project
    Permission.PROJECT_VIEW,
    Permission.PROJECT_CREATE,
    Permission.PROJECT_UPDATE,
    Permission.PROJECT_DELETE,
    Permission.PROJECT_MANAGE_MEMBERS,
    Permission.PROJECT_MANAGE_SETTINGS,
    // Test Cases
    Permission.TEST_CASE_VIEW,
    Permission.TEST_CASE_CREATE,
    Permission.TEST_CASE_UPDATE,
    Permission.TEST_CASE_DELETE,
    Permission.TEST_CASE_EXECUTE,
    // Test Runs
    Permission.TEST_RUN_VIEW,
    Permission.TEST_RUN_CREATE,
    Permission.TEST_RUN_UPDATE,
    Permission.TEST_RUN_DELETE,
    Permission.TEST_RUN_EXECUTE,
    Permission.TEST_RUN_VIEW_RESULTS,
    // Documentation
    Permission.DOC_VIEW,
    Permission.DOC_CREATE,
    Permission.DOC_UPDATE,
    Permission.DOC_DELETE,
    Permission.DOC_MANAGE_VERSIONS,
    Permission.DOC_RESTORE,
    Permission.DOC_REVIEW_REQUEST,
    Permission.DOC_REVIEW_APPROVE,
    Permission.DOC_REVIEW_REJECT,
    Permission.DOC_PUBLISH,
    // Files
    Permission.FILE_VIEW,
    Permission.FILE_UPLOAD,
    Permission.FILE_DELETE,
    Permission.FILE_MANAGE,
    // Suites
    Permission.SUITE_VIEW,
    Permission.SUITE_CREATE,
    Permission.SUITE_UPDATE,
    Permission.SUITE_DELETE,
  ],

  /**
   * Workspace Admin - full access except workspace deletion
   */
  WORKSPACE_ADMIN: [
    // Workspace
    Permission.WORKSPACE_VIEW,
    Permission.WORKSPACE_UPDATE,
    Permission.WORKSPACE_MANAGE_MEMBERS,
    Permission.WORKSPACE_MANAGE_SETTINGS,
    // Project
    Permission.PROJECT_VIEW,
    Permission.PROJECT_CREATE,
    Permission.PROJECT_UPDATE,
    Permission.PROJECT_DELETE,
    Permission.PROJECT_MANAGE_MEMBERS,
    Permission.PROJECT_MANAGE_SETTINGS,
    // Test Cases
    Permission.TEST_CASE_VIEW,
    Permission.TEST_CASE_CREATE,
    Permission.TEST_CASE_UPDATE,
    Permission.TEST_CASE_DELETE,
    Permission.TEST_CASE_EXECUTE,
    // Test Runs
    Permission.TEST_RUN_VIEW,
    Permission.TEST_RUN_CREATE,
    Permission.TEST_RUN_UPDATE,
    Permission.TEST_RUN_DELETE,
    Permission.TEST_RUN_EXECUTE,
    Permission.TEST_RUN_VIEW_RESULTS,
    // Documentation
    Permission.DOC_VIEW,
    Permission.DOC_CREATE,
    Permission.DOC_UPDATE,
    Permission.DOC_DELETE,
    Permission.DOC_MANAGE_VERSIONS,
    Permission.DOC_RESTORE,
    Permission.DOC_REVIEW_REQUEST,
    Permission.DOC_REVIEW_APPROVE,
    Permission.DOC_REVIEW_REJECT,
    Permission.DOC_PUBLISH,
    // Files
    Permission.FILE_VIEW,
    Permission.FILE_UPLOAD,
    Permission.FILE_DELETE,
    Permission.FILE_MANAGE,
    // Suites
    Permission.SUITE_VIEW,
    Permission.SUITE_CREATE,
    Permission.SUITE_UPDATE,
    Permission.SUITE_DELETE,
  ],

  /**
   * Project Lead - full access to project content
   */
  PROJECT_LEAD: [
    // Workspace
    Permission.WORKSPACE_VIEW,
    // Project
    Permission.PROJECT_VIEW,
    Permission.PROJECT_UPDATE,
    Permission.PROJECT_MANAGE_MEMBERS,
    Permission.PROJECT_MANAGE_SETTINGS,
    // Test Cases
    Permission.TEST_CASE_VIEW,
    Permission.TEST_CASE_CREATE,
    Permission.TEST_CASE_UPDATE,
    Permission.TEST_CASE_DELETE,
    Permission.TEST_CASE_EXECUTE,
    // Test Runs
    Permission.TEST_RUN_VIEW,
    Permission.TEST_RUN_CREATE,
    Permission.TEST_RUN_UPDATE,
    Permission.TEST_RUN_DELETE,
    Permission.TEST_RUN_EXECUTE,
    Permission.TEST_RUN_VIEW_RESULTS,
    // Documentation
    Permission.DOC_VIEW,
    Permission.DOC_CREATE,
    Permission.DOC_UPDATE,
    Permission.DOC_DELETE,
    Permission.DOC_MANAGE_VERSIONS,
    Permission.DOC_RESTORE,
    Permission.DOC_REVIEW_REQUEST,
    Permission.DOC_REVIEW_APPROVE,
    Permission.DOC_REVIEW_REJECT,
    Permission.DOC_PUBLISH,
    // Files
    Permission.FILE_VIEW,
    Permission.FILE_UPLOAD,
    Permission.FILE_DELETE,
    Permission.FILE_MANAGE,
    // Suites
    Permission.SUITE_VIEW,
    Permission.SUITE_CREATE,
    Permission.SUITE_UPDATE,
    Permission.SUITE_DELETE,
  ],

  /**
   * QA Engineer - can create and execute tests
   */
  QA_ENGINEER: [
    // Workspace
    Permission.WORKSPACE_VIEW,
    // Project
    Permission.PROJECT_VIEW,
    // Test Cases
    Permission.TEST_CASE_VIEW,
    Permission.TEST_CASE_CREATE,
    Permission.TEST_CASE_UPDATE,
    Permission.TEST_CASE_EXECUTE,
    // Test Runs
    Permission.TEST_RUN_VIEW,
    Permission.TEST_RUN_CREATE,
    Permission.TEST_RUN_UPDATE,
    Permission.TEST_RUN_EXECUTE,
    Permission.TEST_RUN_VIEW_RESULTS,
    // Documentation
    Permission.DOC_VIEW,
    Permission.DOC_CREATE,
    Permission.DOC_UPDATE,
    Permission.DOC_REVIEW_REQUEST,
    // Files
    Permission.FILE_VIEW,
    Permission.FILE_UPLOAD,
    // Suites
    Permission.SUITE_VIEW,
    Permission.SUITE_CREATE,
    Permission.SUITE_UPDATE,
  ],

  /**
   * Tester - can view and execute tests
   */
  TESTER: [
    // Workspace
    Permission.WORKSPACE_VIEW,
    // Project
    Permission.PROJECT_VIEW,
    // Test Cases
    Permission.TEST_CASE_VIEW,
    Permission.TEST_CASE_EXECUTE,
    // Test Runs
    Permission.TEST_RUN_VIEW,
    Permission.TEST_RUN_CREATE,
    Permission.TEST_RUN_EXECUTE,
    Permission.TEST_RUN_VIEW_RESULTS,
    // Documentation
    Permission.DOC_VIEW,
    Permission.DOC_REVIEW_REQUEST,
    // Files
    Permission.FILE_VIEW,
    Permission.FILE_UPLOAD,
    // Suites
    Permission.SUITE_VIEW,
  ],

  /**
   * Viewer - read-only access
   */
  VIEWER: [
    // Workspace
    Permission.WORKSPACE_VIEW,
    // Project
    Permission.PROJECT_VIEW,
    // Test Cases
    Permission.TEST_CASE_VIEW,
    // Test Runs
    Permission.TEST_RUN_VIEW,
    Permission.TEST_RUN_VIEW_RESULTS,
    // Documentation
    Permission.DOC_VIEW,
    // Files
    Permission.FILE_VIEW,
    // Suites
    Permission.SUITE_VIEW,
  ],
} as const

/**
 * Map old role names to permission sets
 * This allows backward compatibility
 */
export const RoleToPermissionSet: Record<string, Permission[]> = {
  superadmin: [...PermissionSets.SUPERADMIN],
  owner: [...PermissionSets.WORKSPACE_OWNER],
  admin: [...PermissionSets.WORKSPACE_ADMIN],
  lead: [...PermissionSets.PROJECT_LEAD],
  qa: [...PermissionSets.QA_ENGINEER],
  tester: [...PermissionSets.TESTER],
  member: [...PermissionSets.VIEWER],
  viewer: [...PermissionSets.VIEWER],
}

/**
 * Get permissions for a role
 */
export function getPermissionsForRole(role: string): Permission[] {
  const permissions = RoleToPermissionSet[role.toLowerCase()]
  return permissions ? [...permissions] : [...PermissionSets.VIEWER]
}

