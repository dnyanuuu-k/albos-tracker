/**
 * Notification Helper Functions
 * Utilities for triggering notifications from various system events
 */

import { db } from '@/lib/db';
import { NotificationType } from '@prisma/client';
import { serverConfig } from '@/lib/server-config';

export interface NotificationOptions {
  userId: string;
  orgId: string;
  type: NotificationType;
  title: string;
  message: string;
  refEntity?: string;
  refId?: string;
}

/**
 * Create and broadcast a notification
 */
export async function createNotification(
  options: NotificationOptions
): Promise<any> {
  const { userId, orgId, type, title, message, refEntity, refId } = options;

  // Create notification in database
  const notification = await db.notification.create({
    data: {
      orgId,
      userId,
      type,
      title,
      message,
      refEntity,
      refId,
    },
  });

  // Broadcast to optional Socket.IO sidecar if running (see NOTIFICATION_SERVICE_URL)
  try {
    await fetch(`${serverConfig.notificationServiceUrl}/internal/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        notification: {
          id: notification.id,
          orgId: notification.orgId,
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          refEntity: notification.refEntity,
          refId: notification.refId,
          readAt: notification.readAt,
          createdAt: notification.createdAt,
        },
      }),
    }).catch(() => {
      // Ignore errors - notification service might not be running
    });
  } catch (error) {
    // Ignore errors
  }

  return notification;
}

/**
 * Notify user when a task is assigned to them
 */
export async function notifyTaskAssigned(
  userId: string,
  orgId: string,
  taskTitle: string,
  taskId: string,
  assignerName?: string
): Promise<void> {
  const title = 'New Task Assigned';
  const message = assignerName
    ? `${assignerName} assigned you a new task: "${taskTitle}"`
    : `You have been assigned a new task: "${taskTitle}"`;

  await createNotification({
    userId,
    orgId,
    type: 'TASK_ASSIGNED',
    title,
    message,
    refEntity: 'Task',
    refId: taskId,
  });
}

/**
 * Notify user when a task status changes
 */
export async function notifyTaskStatusChanged(
  userIds: string[],
  orgId: string,
  taskTitle: string,
  taskId: string,
  oldStatus: string,
  newStatus: string
): Promise<void> {
  const title = 'Task Status Updated';
  const message = `Task "${taskTitle}" changed from ${oldStatus} to ${newStatus}`;

  for (const userId of userIds) {
    await createNotification({
      userId,
      orgId,
      type: 'STATUS_CHANGED',
      title,
      message,
      refEntity: 'Task',
      refId: taskId,
    });
  }
}

/**
 * Notify user when a task is due soon (24h or 48h)
 */
export async function notifyTaskDueReminder(
  userId: string,
  orgId: string,
  taskTitle: string,
  taskId: string,
  hoursUntilDue: number
): Promise<void> {
  const title = 'Task Due Soon';
  const message =
    hoursUntilDue <= 24
      ? `Task "${taskTitle}" is due in ${hoursUntilDue} hours`
      : `Task "${taskTitle}" is due in ${hoursUntilDue / 24} days`;

  await createNotification({
    userId,
    orgId,
    type: 'DUE_REMINDER',
    title,
    message,
    refEntity: 'Task',
    refId: taskId,
  });
}

/**
 * Notify user when they are mentioned in a comment
 */
export async function notifyUserMentioned(
  userId: string,
  orgId: string,
  taskTitle: string,
  taskId: string,
  commenterName: string
): Promise<void> {
  const title = 'You Were Mentioned';
  const message = `${commenterName} mentioned you in a comment on task: "${taskTitle}"`;

  await createNotification({
    userId,
    orgId,
    type: 'MENTION',
    title,
    message,
    refEntity: 'Task',
    refId: taskId,
  });
}

/**
 * Notify user when a department transfer is initiated
 */
export async function notifyTransferInitiated(
  userId: string,
  orgId: string,
  fromDeptName: string,
  toDeptName: string,
  transferId: string,
  initiatorName: string
): Promise<void> {
  const title = 'Transfer Initiated';
  const message = `${initiatorName} initiated your transfer from ${fromDeptName} to ${toDeptName}`;

  await createNotification({
    userId,
    orgId,
    type: 'TRANSFER_INITIATED',
    title,
    message,
    refEntity: 'Transfer',
    refId: transferId,
  });
}

/**
 * Notify user when a department transfer is approved
 */
export async function notifyTransferApproved(
  userId: string,
  orgId: string,
  toDeptName: string,
  transferId: string
): Promise<void> {
  const title = 'Transfer Approved';
  const message = `Your transfer to ${toDeptName} has been approved`;

  await createNotification({
    userId,
    orgId,
    type: 'TRANSFER_APPROVED',
    title,
    message,
    refEntity: 'Transfer',
    refId: transferId,
  });
}

/**
 * Notify user when an invitation is sent to them
 */
export async function notifyInviteSent(
  email: string,
  orgId: string,
  orgName: string,
  inviterName: string
): Promise<void> {
  // Note: This is for email notifications, in-app notifications require a user ID
  // This function would typically send an email
  const title = 'Invitation to Join';
  const message = `${inviterName} invited you to join ${orgName}`;

  // Create a notification if we can find the user by email
  try {
    const user = await db.user.findUnique({
      where: { email, orgId },
    });

    if (user) {
      await createNotification({
        userId: user.id,
        orgId,
        type: 'INVITE_SENT',
        title,
        message,
        refEntity: 'Invitation',
      });
    }
  } catch (error) {
    // Ignore if user doesn't exist yet
  }
}

/**
 * Notify admin when invitation is accepted
 */
export async function notifyInviteAccepted(
  adminUserId: string,
  orgId: string,
  userName: string
): Promise<void> {
  const title = 'Invitation Accepted';
  const message = `${userName} has accepted the invitation and joined the organization`;

  await createNotification({
    userId: adminUserId,
    orgId,
    type: 'INVITE_ACCEPTED',
    title,
    message,
    refEntity: 'User',
  });
}

/**
 * Notify user when a task is rejected
 */
export async function notifyTaskRejected(
  userId: string,
  orgId: string,
  taskTitle: string,
  taskId: string,
  rejectorName: string,
  reason?: string
): Promise<void> {
  const title = 'Task Rejected';
  const message = reason
    ? `${rejectorName} rejected task "${taskTitle}": ${reason}`
    : `${rejectorName} rejected task "${taskTitle}"`;

  await createNotification({
    userId,
    orgId,
    type: 'TASK_REJECTED',
    title,
    message,
    refEntity: 'Task',
    refId: taskId,
  });
}

/**
 * Notify user when a task is escalated
 */
export async function notifyTaskEscalation(
  userId: string,
  orgId: string,
  taskTitle: string,
  taskId: string,
  escalatedTo: string
): Promise<void> {
  const title = 'Task Escalated';
  const message = `Task "${taskTitle}" has been escalated to ${escalatedTo}`;

  await createNotification({
    userId,
    orgId,
    type: 'ESCALATION',
    title,
    message,
    refEntity: 'Task',
    refId: taskId,
  });
}

/**
 * Send bulk notifications to multiple users
 */
export async function createBulkNotifications(
  userIds: string[],
  options: Omit<NotificationOptions, 'userId'>
): Promise<any[]> {
  const notifications = await Promise.all(
    userIds.map((userId) =>
      createNotification({
        ...options,
        userId,
      })
    )
  );

  return notifications;
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(
  userId: string,
  orgId: string
): Promise<number> {
  return db.notification.count({
    where: {
      userId,
      orgId,
      readAt: null,
    },
  });
}
