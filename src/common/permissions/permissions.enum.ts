/**
 * System permissions enum
 * Defines all possible permissions for different system blocks
 */
export enum Permission {
  // Workspace permissions
  WORKSPACE_VIEW = 'workspace:view',
  WORKSPACE_CREATE = 'workspace:create',
  WORKSPACE_UPDATE = 'workspace:update',
  WORKSPACE_DELETE = 'workspace:delete',
  WORKSPACE_MANAGE_MEMBERS = 'workspace:manage_members',
  WORKSPACE_MANAGE_SETTINGS = 'workspace:manage_settings',

  // Project permissions
  PROJECT_VIEW = 'project:view',
  PROJECT_CREATE = 'project:create',
  PROJECT_UPDATE = 'project:update',
  PROJECT_DELETE = 'project:delete',
  PROJECT_MANAGE_MEMBERS = 'project:manage_members',
  PROJECT_MANAGE_SETTINGS = 'project:manage_settings',

  // Test Cases permissions
  TEST_CASE_VIEW = 'test_case:view',
  TEST_CASE_CREATE = 'test_case:create',
  TEST_CASE_UPDATE = 'test_case:update',
  TEST_CASE_DELETE = 'test_case:delete',
  TEST_CASE_EXECUTE = 'test_case:execute',

  // Test Runs permissions
  TEST_RUN_VIEW = 'test_run:view',
  TEST_RUN_CREATE = 'test_run:create',
  TEST_RUN_UPDATE = 'test_run:update',
  TEST_RUN_DELETE = 'test_run:delete',
  TEST_RUN_EXECUTE = 'test_run:execute',
  TEST_RUN_VIEW_RESULTS = 'test_run:view_results',

  // Documentation permissions
  DOC_VIEW = 'doc:view',
  DOC_CREATE = 'doc:create',
  DOC_UPDATE = 'doc:update',
  DOC_DELETE = 'doc:delete',
  DOC_MANAGE_VERSIONS = 'doc:manage_versions',
  DOC_RESTORE = 'doc:restore',
  DOC_REVIEW_REQUEST = 'doc:review_request',
  DOC_REVIEW_APPROVE = 'doc:review_approve',
  DOC_REVIEW_REJECT = 'doc:review_reject',
  DOC_PUBLISH = 'doc:publish',

  // File Assets permissions
  FILE_VIEW = 'file:view',
  FILE_UPLOAD = 'file:upload',
  FILE_DELETE = 'file:delete',
  FILE_MANAGE = 'file:manage',

  // Suites permissions
  SUITE_VIEW = 'suite:view',
  SUITE_CREATE = 'suite:create',
  SUITE_UPDATE = 'suite:update',
  SUITE_DELETE = 'suite:delete',
}

/**
 * Permission groups for easier management
 */
export const PermissionGroups = {
  WORKSPACE: [
    Permission.WORKSPACE_VIEW,
    Permission.WORKSPACE_CREATE,
    Permission.WORKSPACE_UPDATE,
    Permission.WORKSPACE_DELETE,
    Permission.WORKSPACE_MANAGE_MEMBERS,
    Permission.WORKSPACE_MANAGE_SETTINGS,
  ],
  PROJECT: [
    Permission.PROJECT_VIEW,
    Permission.PROJECT_CREATE,
    Permission.PROJECT_UPDATE,
    Permission.PROJECT_DELETE,
    Permission.PROJECT_MANAGE_MEMBERS,
    Permission.PROJECT_MANAGE_SETTINGS,
  ],
  TEST_CASE: [
    Permission.TEST_CASE_VIEW,
    Permission.TEST_CASE_CREATE,
    Permission.TEST_CASE_UPDATE,
    Permission.TEST_CASE_DELETE,
    Permission.TEST_CASE_EXECUTE,
  ],
  TEST_RUN: [
    Permission.TEST_RUN_VIEW,
    Permission.TEST_RUN_CREATE,
    Permission.TEST_RUN_UPDATE,
    Permission.TEST_RUN_DELETE,
    Permission.TEST_RUN_EXECUTE,
    Permission.TEST_RUN_VIEW_RESULTS,
  ],
  DOC: [
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
  ],
  FILE: [
    Permission.FILE_VIEW,
    Permission.FILE_UPLOAD,
    Permission.FILE_DELETE,
    Permission.FILE_MANAGE,
  ],
  SUITE: [
    Permission.SUITE_VIEW,
    Permission.SUITE_CREATE,
    Permission.SUITE_UPDATE,
    Permission.SUITE_DELETE,
  ],
} as const

/**
 * All permissions as array
 */
export const ALL_PERMISSIONS = Object.values(Permission)










