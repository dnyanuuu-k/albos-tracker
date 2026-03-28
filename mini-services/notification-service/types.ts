/**
 * Notification Types and Interfaces
 */

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'STATUS_CHANGED'
  | 'DUE_REMINDER'
  | 'MENTION'
  | 'TRANSFER_INITIATED'
  | 'TRANSFER_APPROVED'
  | 'INVITE_SENT'
  | 'INVITE_ACCEPTED'
  | 'TASK_REJECTED'
  | 'ESCALATION';

export interface JWTPayload {
  userId: string;
  orgId: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
}

export interface NotificationData {
  id: string;
  orgId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  refEntity?: string | null;
  refId?: string | null;
  readAt?: Date | null;
  createdAt: Date;
}

export interface SocketAuthData {
  token: string;
}

export interface SocketAuthenticatedUser {
  userId: string;
  orgId: string;
  email: string;
  role: string;
}

export interface NotificationSendRequest {
  userId: string;
  orgId: string;
  type: NotificationType;
  title: string;
  message: string;
  refEntity?: string;
  refId?: string;
}

export interface MarkAsReadRequest {
  notificationId: string;
  userId: string;
}

export interface MarkAllAsReadRequest {
  userId: string;
}

export interface DeleteNotificationRequest {
  notificationId: string;
  userId: string;
}
