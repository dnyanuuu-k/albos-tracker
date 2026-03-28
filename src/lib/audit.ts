import { db } from '@/lib/db';
import { AuditAction } from '@prisma/client';

export interface AuditLogData {
  orgId: string;
  actorId: string;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  oldVal?: string | null;
  newVal?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(data: AuditLogData) {
  try {
    await db.auditLog.create({
      data: {
        orgId: data.orgId,
        actorId: data.actorId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId || null,
        oldVal: data.oldVal || null,
        newVal: data.newVal || null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw error - audit logging should not break the main flow
  }
}

/**
 * Helper to log entity creation
 */
export async function logEntityCreation(
  orgId: string,
  actorId: string,
  entity: string,
  entityId: string,
  entityData: any
) {
  return createAuditLog({
    orgId,
    actorId,
    action: AuditAction.CREATE,
    entity,
    entityId,
    newVal: JSON.stringify(entityData),
  });
}

/**
 * Helper to log entity update
 */
export async function logEntityUpdate(
  orgId: string,
  actorId: string,
  entity: string,
  entityId: string,
  oldData: any,
  newData: any
) {
  return createAuditLog({
    orgId,
    actorId,
    action: AuditAction.UPDATE,
    entity,
    entityId,
    oldVal: JSON.stringify(oldData),
    newVal: JSON.stringify(newData),
  });
}

/**
 * Helper to log entity deletion
 */
export async function logEntityDeletion(
  orgId: string,
  actorId: string,
  entity: string,
  entityId: string,
  entityData: any
) {
  return createAuditLog({
    orgId,
    actorId,
    action: AuditAction.DELETE,
    entity,
    entityId,
    oldVal: JSON.stringify(entityData),
  });
}

/**
 * Helper to log audit access (viewing audit logs)
 */
export async function logAuditAccess(
  orgId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  return createAuditLog({
    orgId,
    actorId: userId,
    action: AuditAction.LOGIN, // Using LOGIN as a proxy for access
    entity: 'AuditLog',
    entityId: null,
    ipAddress,
    userAgent,
  });
}

/**
 * Helper to log failed login attempt
 */
export async function logFailedLogin(
  email: string,
  reason: string,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await db.auditLog.create({
      data: {
        orgId: 'unknown',
        actorId: 'unknown',
        action: AuditAction.LOGIN,
        entity: 'User',
        entityId: null,
        oldVal: JSON.stringify({ email, reason }),
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error('Failed to log failed login:', error);
  }
}

/**
 * Helper to log login event
 */
export async function logLogin(
  orgId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  return createAuditLog({
    orgId,
    actorId: userId,
    action: AuditAction.LOGIN,
    entity: 'User',
    entityId: userId,
    ipAddress,
    userAgent,
  });
}

/**
 * Helper to log logout event
 */
export async function logLogout(
  orgId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  return createAuditLog({
    orgId,
    actorId: userId,
    action: AuditAction.LOGOUT,
    entity: 'User',
    entityId: userId,
    ipAddress,
    userAgent,
  });
}
