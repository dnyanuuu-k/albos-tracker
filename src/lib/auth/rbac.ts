import { UserRole } from '@prisma/client';

// Role hierarchy (higher number = more permissions)
const ROLE_HIERARCHY: Record<UserRole, number> = {
  EMPLOYEE: 1,
  DEPT_MANAGER: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

// Permission definitions
export enum Permission {
  // Organization permissions
  ORG_CREATE = 'org:create',
  ORG_DELETE = 'org:delete',
  ORG_MANAGE_BILLING = 'org:manage_billing',
  ORG_VIEW_SETTINGS = 'org:view_settings',

  // Department permissions
  DEPT_CREATE = 'dept:create',
  DEPT_EDIT = 'dept:edit',
  DEPT_DELETE = 'dept:delete',
  DEPT_ARCHIVE = 'dept:archive',
  DEPT_VIEW_ALL = 'dept:view_all',

  // Employee permissions
  EMP_INVITE = 'emp:invite',
  EMP_REMOVE = 'emp:remove',
  EMP_EDIT_ROLE = 'emp:edit_role',
  EMP_TRANSFER = 'emp:transfer',
  EMP_VIEW_ALL = 'emp:view_all',
  EMP_VIEW_DEPT = 'emp:view_dept',

  // Task permissions
  TASK_CREATE_ANY = 'task:create_any',
  TASK_CREATE_OWN = 'task:create_own',
  TASK_CREATE_DEPT = 'task:create_dept',
  TASK_VIEW_ALL = 'task:view_all',
  TASK_VIEW_DEPT = 'task:view_dept',
  TASK_VIEW_OWN = 'task:view_own',
  TASK_EDIT_ANY = 'task:edit_any',
  TASK_EDIT_OWN = 'task:edit_own',
  TASK_DELETE_ANY = 'task:delete_any',
  TASK_ASSIGN = 'task:assign',
  TASK_APPROVE = 'task:approve',
  TASK_REJECT = 'task:reject',

  // Report permissions
  REPORT_VIEW_ALL = 'report:view_all',
  REPORT_VIEW_DEPT = 'report:view_dept',
  REPORT_VIEW_OWN = 'report:view_own',
  REPORT_EXPORT = 'report:export',

  // System permissions
  AUDIT_VIEW = 'audit:view',
  SYSTEM_CONFIG = 'system:config',
}

// Role-to-permission mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    // Organization
    Permission.ORG_CREATE,
    Permission.ORG_DELETE,
    Permission.ORG_MANAGE_BILLING,
    Permission.ORG_VIEW_SETTINGS,

    // Department
    Permission.DEPT_CREATE,
    Permission.DEPT_EDIT,
    Permission.DEPT_DELETE,
    Permission.DEPT_ARCHIVE,
    Permission.DEPT_VIEW_ALL,

    // Employee
    Permission.EMP_INVITE,
    Permission.EMP_REMOVE,
    Permission.EMP_EDIT_ROLE,
    Permission.EMP_TRANSFER,
    Permission.EMP_VIEW_ALL,
    Permission.EMP_VIEW_DEPT,

    // Task
    Permission.TASK_CREATE_ANY,
    Permission.TASK_CREATE_OWN,
    Permission.TASK_VIEW_ALL,
    Permission.TASK_VIEW_DEPT,
    Permission.TASK_VIEW_OWN,
    Permission.TASK_EDIT_ANY,
    Permission.TASK_EDIT_OWN,
    Permission.TASK_DELETE_ANY,
    Permission.TASK_ASSIGN,
    Permission.TASK_APPROVE,
    Permission.TASK_REJECT,

    // Report
    Permission.REPORT_VIEW_ALL,
    Permission.REPORT_VIEW_DEPT,
    Permission.REPORT_VIEW_OWN,
    Permission.REPORT_EXPORT,

    // System
    Permission.AUDIT_VIEW,
    Permission.SYSTEM_CONFIG,
  ],

  ADMIN: [
    // Department
    Permission.DEPT_CREATE,
    Permission.DEPT_EDIT,
    Permission.DEPT_ARCHIVE,
    Permission.DEPT_VIEW_ALL,

    // Employee
    Permission.EMP_INVITE,
    Permission.EMP_REMOVE,
    Permission.EMP_EDIT_ROLE,
    Permission.EMP_TRANSFER,
    Permission.EMP_VIEW_ALL,
    Permission.EMP_VIEW_DEPT,

    // Task
    Permission.TASK_CREATE_ANY,
    Permission.TASK_CREATE_OWN,
    Permission.TASK_VIEW_ALL,
    Permission.TASK_VIEW_DEPT,
    Permission.TASK_VIEW_OWN,
    Permission.TASK_EDIT_ANY,
    Permission.TASK_EDIT_OWN,
    Permission.TASK_DELETE_ANY,
    Permission.TASK_ASSIGN,
    Permission.TASK_APPROVE,
    Permission.TASK_REJECT,

    // Report
    Permission.REPORT_VIEW_ALL,
    Permission.REPORT_VIEW_DEPT,
    Permission.REPORT_VIEW_OWN,
    Permission.REPORT_EXPORT,

    // System
    Permission.AUDIT_VIEW,
  ],

  DEPT_MANAGER: [
    // Department
    Permission.DEPT_EDIT,
    Permission.DEPT_VIEW_ALL,

    // Employee
    Permission.EMP_VIEW_DEPT,
    Permission.EMP_TRANSFER,

    // Task
    Permission.TASK_CREATE_DEPT,
    Permission.TASK_CREATE_OWN,
    Permission.TASK_VIEW_DEPT,
    Permission.TASK_VIEW_OWN,
    Permission.TASK_EDIT_OWN,
    Permission.TASK_ASSIGN,
    Permission.TASK_APPROVE,
    Permission.TASK_REJECT,

    // Report
    Permission.REPORT_VIEW_DEPT,
    Permission.REPORT_VIEW_OWN,
    Permission.REPORT_EXPORT,
  ],

  EMPLOYEE: [
    // Task
    Permission.TASK_CREATE_OWN,
    Permission.TASK_VIEW_OWN,
    Permission.TASK_EDIT_OWN,

    // Team visibility (employees can view users in their own department)
    Permission.EMP_VIEW_DEPT,

    // Report
    Permission.REPORT_VIEW_OWN,
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/**
 * Check if user role is at least the specified minimum level
 */
export function hasRoleLevel(role: UserRole, minimumLevel: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimumLevel];
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Check if user can perform action on resource in their department
 */
export function canAccessDepartment(
  userRole: UserRole,
  userDeptId: string | null,
  targetDeptId: string
): boolean {
  // Super Admin and Admin can access all departments
  if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN) {
    return true;
  }

  // Dept Manager can access their own department
  if (userRole === UserRole.DEPT_MANAGER) {
    return userDeptId === targetDeptId;
  }

  // Employees cannot access department-level resources
  return false;
}

/**
 * Check if user can view another user's information
 */
export function canViewUser(
  viewerRole: UserRole,
  viewerDeptId: string | null,
  viewerId: string,
  targetUserId: string,
  targetDeptId: string | null
): boolean {
  // Can always view self
  if (viewerId === targetUserId) {
    return true;
  }

  // Super Admin and Admin can view all users
  if (viewerRole === UserRole.SUPER_ADMIN || viewerRole === UserRole.ADMIN) {
    return true;
  }

  // Dept Manager can view users in their department
  if (viewerRole === UserRole.DEPT_MANAGER && viewerDeptId === targetDeptId) {
    return true;
  }

  return false;
}

/**
 * Get role hierarchy level
 */
export function getRoleLevel(role: UserRole): number {
  return ROLE_HIERARCHY[role] ?? 0;
}

/**
 * Check if one role is higher than another
 */
export function isRoleHigher(role1: UserRole, role2: UserRole): boolean {
  return getRoleLevel(role1) > getRoleLevel(role2);
}
