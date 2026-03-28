import { z } from 'zod';

export const TaskStatusEnum = z.enum([
  'TO_DO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
  'ON_HOLD',
  'OVERDUE',
  'CANCELLED',
]);

export const TaskPriorityEnum = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().optional(),
  priority: TaskPriorityEnum.default('MEDIUM'),
  status: TaskStatusEnum.default('TO_DO'),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedHours: z.number().min(0).max(9999).nullable().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  deptId: z.string().min(1, 'Department is required'),
  assigneeIds: z.array(z.string()).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters').optional(),
  description: z.string().optional(),
  priority: TaskPriorityEnum.optional(),
  status: TaskStatusEnum.optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedHours: z.number().min(0).max(9999).nullable().optional(),
  actualHours: z.number().min(0).max(9999).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  deptId: z.string().optional(),
});

export const updateTaskStatusSchema = z.object({
  status: TaskStatusEnum,
  reason: z.string().optional(),
});

export const addAssigneeSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export const taskFilterSchema = z.object({
  status: TaskStatusEnum.optional(),
  priority: TaskPriorityEnum.optional(),
  deptId: z.string().optional(),
  assigneeId: z.string().optional(),
  creatorId: z.string().optional(),
  search: z.string().optional(),
  category: z.string().optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'dueDate', 'priority', 'status', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Task Update validation schemas
export const createTaskUpdateSchema = z.object({
  progress: z.number().int().min(0).max(100, 'Progress must be between 0 and 100'),
  hours: z.number().min(0).max(9999, 'Hours must be between 0 and 9999'),
  note: z.string().max(2000, 'Note must be less than 2000 characters').optional(),
  blockers: z.array(z.string()).max(10, 'Maximum 10 blockers allowed').optional(),
});

export const updateTaskUpdateSchema = z.object({
  progress: z.number().int().min(0).max(100, 'Progress must be between 0 and 100').optional(),
  hours: z.number().min(0).max(9999, 'Hours must be between 0 and 9999').optional(),
  note: z.string().max(2000, 'Note must be less than 2000 characters').optional(),
  blockers: z.array(z.string()).max(10, 'Maximum 10 blockers allowed').optional(),
});

export const updateFilterSchema = z.object({
  taskId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'progress', 'hours']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type AddAssigneeInput = z.infer<typeof addAssigneeSchema>;
export type TaskFilterInput = z.infer<typeof taskFilterSchema>;
export type CreateTaskUpdateInput = z.infer<typeof createTaskUpdateSchema>;
export type UpdateTaskUpdateInput = z.infer<typeof updateTaskUpdateSchema>;
export type UpdateFilterInput = z.infer<typeof updateFilterSchema>;
