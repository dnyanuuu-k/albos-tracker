export interface Task {
  id: string;
  orgId: string;
  deptId: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  category?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedBy?: string;
  rejectedReason?: string;
  department: {
    id: string;
    name: string;
    code: string;
  };
  creator: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl?: string | null;
  };
  assignees: TaskAssignee[];
  _count?: {
    comments: number;
    updates: number;
    subtasks: number;
  };
}

export interface TaskAssignee {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl?: string | null;
    designation?: string | null;
  };
  assignedAt: string;
}

export type TaskStatus = 'TO_DO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'ON_HOLD' | 'OVERDUE' | 'CANCELLED';
export type TaskPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  deptId?: string;
  assigneeId?: string;
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}

export interface TaskResponse {
  tasks: Task[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
