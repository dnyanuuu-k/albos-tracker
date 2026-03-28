import { z } from 'zod';
import { TransferStatus } from '@prisma/client';

// List transfers query schema
export const listTransfersSchema = z.object({
  status: z.nativeEnum(TransferStatus).optional(),
  userId: z.string().optional(),
  fromDeptId: z.string().optional(),
  toDeptId: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.string().optional().transform((val) => val ? parseInt(val) : 1),
  limit: z.string().optional().transform((val) => val ? parseInt(val) : 20),
});

// Create transfer schema
export const createTransferSchema = z.object({
  userId: z.string().min(1, 'Employee is required'),
  fromDeptId: z.string().min(1, 'Current department is required'),
  toDeptId: z.string().min(1, 'Target department is required'),
  effectiveDate: z.string().min(1, 'Effective date is required'),
  reason: z.string().min(1, 'Reason is required'),
  taskReassignments: z.record(z.string()).optional(), // taskId -> newAssigneeId mapping
});

// Approve transfer schema
export const approveTransferSchema = z.object({
  note: z.string().optional(),
});

// Reject transfer schema
export const rejectTransferSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

// Cancel transfer schema
export const cancelTransferSchema = z.object({
  reason: z.string().optional(),
});

// Types
export type ListTransfersInput = z.infer<typeof listTransfersSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type ApproveTransferInput = z.infer<typeof approveTransferSchema>;
export type RejectTransferInput = z.infer<typeof rejectTransferSchema>;
export type CancelTransferInput = z.infer<typeof cancelTransferSchema>;
