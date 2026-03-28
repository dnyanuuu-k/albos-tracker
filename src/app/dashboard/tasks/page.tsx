'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { api } from '@/lib/api';
import { TaskPriority, TaskStatus } from '@prisma/client';
import CreateTaskDialog from '@/components/tasks/create-task-dialog';
import {
  Plus,
  Search,
  CheckSquare,
  Clock,
  AlertCircle,
  Loader2,
  ChevronRight,
} from 'lucide-react';

function TasksPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (priorityFilter !== 'ALL') params.priority = priorityFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const deptId = searchParams.get('deptId');
      const assigneeId = searchParams.get('assigneeId');
      if (deptId) params.deptId = deptId;
      if (assigneeId) params.assigneeId = assigneeId;

      const data = (await api.getTasks(params)) as { data: any[] };
      setTasks(data.data);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [searchParams, statusFilter, priorityFilter, debouncedSearch]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'IN_PROGRESS':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'IN_REVIEW':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'OVERDUE':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'text-red-500 bg-red-500/10';
      case 'HIGH':
        return 'text-orange-500 bg-orange-500/10';
      case 'MEDIUM':
        return 'text-yellow-500 bg-yellow-500/10';
      default:
        return 'text-slate-500 bg-slate-500/10';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground" />;
      case 'HIGH':
        return <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />;
      case 'MEDIUM':
        return <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const handleInlineStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    setStatusSavingId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
        );
      }
    } catch (e) {
      console.error('Failed to update status');
    } finally {
      setStatusSavingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
            <p className="text-muted-foreground">
              Manage and track all your tasks
            </p>
            {(searchParams.get('deptId') || searchParams.get('assigneeId')) && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Filtered list:</span>
                {searchParams.get('deptId') && (
                  <Badge variant="secondary">This department</Badge>
                )}
                {searchParams.get('assigneeId') && (
                  <Badge variant="secondary">This assignee</Badge>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => router.push('/dashboard/tasks')}
                >
                  Clear filters
                </Button>
              </div>
            )}
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>

          <CreateTaskDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            onSuccess={() => {
              // Refresh the list after successful task creation.
              fetchTasks();
            }}
          />
        </div>

        {/* Filters */}
        <Card className="border-border/80">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tasks..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Status</SelectItem>
                    <SelectItem value="TO_DO">To Do</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="IN_REVIEW">In Review</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Priority</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task list — compact rows, not full-bleed cards */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-xl border border-border/80 bg-card/50 overflow-hidden divide-y divide-border/80">
            {tasks.length === 0 ? (
              <div className="py-16 text-center px-4">
                <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-60" />
                <p className="text-muted-foreground">No tasks found</p>
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(`/dashboard/tasks/${task.id}`);
                    }
                  }}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 text-left cursor-pointer hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <div className="min-w-0 flex-1 flex items-start gap-3">
                    <div className="mt-0.5">{getPriorityIcon(task.priority)}</div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold leading-snug line-clamp-2">{task.title}</h3>
                      {task.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                          {task.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {task.dueDate
                            ? new Date(task.dueDate).toLocaleDateString()
                            : 'No due date'}
                        </span>
                        {task.assignees && task.assignees.length > 0 && (
                          <span className="truncate max-w-[200px]">
                            {task.assignees.map((a: any) => a.user?.name || a.user?.email).filter(Boolean).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex flex-row sm:flex-col items-center sm:items-end gap-2 shrink-0 sm:min-w-[200px] justify-between sm:justify-end"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <Badge className={`${getPriorityColor(task.priority)} tabular-nums`}>
                      {task.priority}
                    </Badge>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <Select
                        value={task.status}
                        disabled={statusSavingId === task.id}
                        onValueChange={(v) =>
                          handleInlineStatusChange(task.id, v as TaskStatus)
                        }
                      >
                        <SelectTrigger
                          className="h-9 w-[min(100%,11rem)] sm:w-44 text-xs"
                          aria-label="Change task status"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.values(TaskStatus) as TaskStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>
                              {s.replace(/_/g, ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {statusSavingId === task.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground hidden sm:block shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DashboardLayout>
      }
    >
      <TasksPageContent />
    </Suspense>
  );
}
