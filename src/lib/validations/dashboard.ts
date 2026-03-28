import { z } from 'zod';

// Dashboard statistics query parameters
export const dashboardStatsSchema = z.object({
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'DEPT_MANAGER', 'EMPLOYEE']).optional(),
  departmentId: z.string().optional(),
  userId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Leaderboard query parameters
export const leaderboardSchema = z.object({
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'DEPT_MANAGER', 'EMPLOYEE']).optional(),
  departmentId: z.string().optional(),
  period: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
  limit: z.coerce.number().min(1).max(50).default(10),
  sortBy: z.enum(['tasksCompleted', 'tasksOnTime', 'hoursLogged']).default('tasksCompleted'),
});

// Activity feed query parameters
export const activityFeedSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  type: z.enum(['task', 'transfer', 'user', 'department', 'all']).default('all'),
});

// Deadlines query parameters
export const deadlinesSchema = z.object({
  days: z.coerce.number().min(1).max(90).default(14),
  departmentId: z.string().optional(),
  userId: z.string().optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'all']).default('all'),
});

// Performance metrics query parameters
export const performanceMetricsSchema = z.object({
  userId: z.string().optional(),
  departmentId: z.string().optional(),
  period: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Export data query parameters
export const exportDataSchema = z.object({
  type: z.enum(['stats', 'leaderboard', 'activity', 'performance']),
  format: z.enum(['csv', 'json']).default('csv'),
  departmentId: z.string().optional(),
  userId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Types
export type DashboardStatsQuery = z.infer<typeof dashboardStatsSchema>;
export type LeaderboardQuery = z.infer<typeof leaderboardSchema>;
export type ActivityFeedQuery = z.infer<typeof activityFeedSchema>;
export type DeadlinesQuery = z.infer<typeof deadlinesSchema>;
export type PerformanceMetricsQuery = z.infer<typeof performanceMetricsSchema>;
export type ExportDataQuery = z.infer<typeof exportDataSchema>;
