import { z } from 'zod';

// Date range filter schema
export const dateRangeSchema = z.object({
  startDate: z.string().or(z.date()).optional(),
  endDate: z.string().or(z.date()).optional(),
  range: z.enum(['today', 'week', 'month', 'quarter', 'year', 'custom']).optional(),
});

// Task completion analytics filter
export const taskCompletionFilterSchema = z.object({
  ...dateRangeSchema.shape,
  departmentId: z.string().optional(),
  userId: z.string().optional(),
  groupBy: z.enum(['day', 'week', 'month']).optional(),
});

// Task distribution analytics filter
export const taskDistributionFilterSchema = z.object({
  ...dateRangeSchema.shape,
  departmentId: z.string().optional(),
  groupBy: z.enum(['status', 'priority', 'department', 'category']).optional(),
});

// Employee performance filter
export const employeePerformanceFilterSchema = z.object({
  ...dateRangeSchema.shape,
  departmentId: z.string().optional(),
  userId: z.string().optional(),
  sort: z.enum(['tasksCompleted', 'hoursLogged', 'avgProgress', 'onTimeDelivery']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// Department comparison filter
export const departmentComparisonFilterSchema = z.object({
  ...dateRangeSchema.shape,
  metric: z.enum(['tasksCompleted', 'hoursLogged', 'avgCompletionTime', 'onTimeRate', 'activeTasks']).optional(),
});

// Trends analytics filter
export const trendsFilterSchema = z.object({
  ...dateRangeSchema.shape,
  departmentId: z.string().optional(),
  metrics: z.array(z.enum(['taskCreation', 'taskCompletion', 'hoursLogged', 'employeeActivity'])).optional(),
  groupBy: z.enum(['day', 'week', 'month']).optional(),
});

// Overdue tasks filter
export const overdueFilterSchema = z.object({
  departmentId: z.string().optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  daysOverdue: z.enum(['1-3', '4-7', '8-14', '15+']).optional(),
});

// Productivity metrics filter
export const productivityFilterSchema = z.object({
  ...dateRangeSchema.shape,
  departmentId: z.string().optional(),
  userId: z.string().optional(),
  groupBy: z.enum(['day', 'week', 'month', 'user', 'department']).optional(),
});

// Monthly report filter
export const monthlyReportFilterSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2100),
  departmentId: z.string().optional(),
  format: z.enum(['pdf', 'csv', 'json']).optional(),
});

// Task summary report filter
export const taskSummaryFilterSchema = z.object({
  ...dateRangeSchema.shape,
  taskId: z.string().optional(),
  departmentId: z.string().optional(),
  userId: z.string().optional(),
  format: z.enum(['pdf', 'csv', 'json', 'excel']).optional(),
});

// Employee summary report filter
export const employeeSummaryFilterSchema = z.object({
  ...dateRangeSchema.shape,
  userId: z.string(),
  format: z.enum(['pdf', 'csv', 'json', 'excel']).optional(),
});

// Department summary report filter
export const departmentSummaryFilterSchema = z.object({
  ...dateRangeSchema.shape,
  departmentId: z.string(),
  format: z.enum(['pdf', 'csv', 'json', 'excel']).optional(),
});

// Custom report filter
export const customReportFilterSchema = z.object({
  name: z.string().min(1, 'Report name is required'),
  ...dateRangeSchema.shape,
  dataSource: z.enum(['tasks', 'employees', 'departments', 'updates']),
  filters: z.object({
    departmentId: z.string().optional(),
    userId: z.string().optional(),
    status: z.array(z.string()).optional(),
    priority: z.array(z.string()).optional(),
    category: z.string().optional(),
  }),
  columns: z.array(z.string()).min(1, 'At least one column must be selected'),
  chartType: z.enum(['none', 'line', 'bar', 'pie', 'area', 'radar']).optional(),
  format: z.enum(['pdf', 'csv', 'json', 'excel']),
  schedule: z.object({
    enabled: z.boolean().optional(),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']).optional(),
    emailRecipients: z.array(z.string()).optional(),
  }).optional(),
});

// Export tasks filter
export const exportTasksFilterSchema = z.object({
  ...dateRangeSchema.shape,
  departmentId: z.string().optional(),
  userId: z.string().optional(),
  status: z.array(z.string()).optional(),
  priority: z.array(z.string()).optional(),
  format: z.enum(['csv', 'excel', 'json']),
  columns: z.array(z.string()).optional(),
});
