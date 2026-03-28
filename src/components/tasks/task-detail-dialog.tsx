'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { TaskUpdateTimeline } from '@/components/updates/task-update-timeline';
import AddUpdateDialog from '@/components/updates/add-update-dialog';
import { Calendar, Clock, Plus, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  category: string | null;
  tags: string[];
  department: {
    id: string;
    name: string;
    code: string;
  };
  creator: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  assignees: Array<{
    id: string;
    user: {
      id: string;
      name: string | null;
      email: string;
      avatarUrl: string | null;
    };
  }>;
}

interface TaskUpdate {
  id: string;
  progress: number;
  hours: number;
  note: string | null;
  blockers: string[];
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  currentUser?: { id: string } | null;
}

export default function TaskDetailDialog({
  open,
  onOpenChange,
  task,
  currentUser,
}: TaskDetailDialogProps) {
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [addUpdateOpen, setAddUpdateOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<TaskUpdate | null>(null);

  useEffect(() => {
    if (open && task) {
      fetchUpdates();
    }
  }, [open, task]);

  const fetchUpdates = async () => {
    if (!task) return;

    try {
      setUpdatesLoading(true);
      const response = await fetch(`/api/tasks/${task.id}/updates?limit=20`);
      if (response.ok) {
        const data = await response.json();
        setUpdates(data.updates);
      }
    } catch (error) {
      console.error('Failed to fetch updates:', error);
    } finally {
      setUpdatesLoading(false);
    }
  };

  const handleUpdateAdded = () => {
    setAddUpdateOpen(false);
    setEditingUpdate(null);
    fetchUpdates();
  };

  const handleUpdateEdit = (updateId: string) => {
    const update = updates.find((u) => u.id === updateId);
    if (update) {
      setEditingUpdate(update);
      setAddUpdateOpen(true);
    }
  };

  const handleUpdateDelete = async (updateId: string) => {
    if (!task || !confirm('Are you sure you want to delete this update?')) return;

    try {
      const response = await fetch(`/api/tasks/${task.id}/updates/${updateId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchUpdates();
      }
    } catch (error) {
      console.error('Failed to delete update:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'HIGH':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'MEDIUM':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'LOW':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TO_DO':
        return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
      case 'IN_PROGRESS':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'IN_REVIEW':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'APPROVED':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'REJECTED':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'COMPLETED':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'ON_HOLD':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'OVERDUE':
        return 'bg-red-600/10 text-red-600 border-red-600/20';
      case 'CANCELLED':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const calculateAverageProgress = () => {
    if (updates.length === 0) return 0;
    return Math.round(updates.reduce((sum, u) => sum + u.progress, 0) / updates.length);
  };

  const getLatestProgress = () => {
    if (updates.length === 0) return 0;
    return updates[0].progress;
  };

  if (!task) return null;

  const latestProgress = getLatestProgress();
  const avgProgress = calculateAverageProgress();
  const isAssigned = task.assignees.some((a) => a.user.id === currentUser?.id);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Task Details</span>
              {isAssigned && (
                <Button size="sm" onClick={() => setAddUpdateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Update
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Task Info */}
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold">{task.title}</h2>
                <p className="text-muted-foreground mt-2">{task.description || 'No description'}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge className={getPriorityColor(task.priority)}>
                  {task.priority}
                </Badge>
                <Badge className={getStatusColor(task.status)}>
                  {task.status.replace('_', ' ')}
                </Badge>
                {task.category && (
                  <Badge variant="outline">{task.category}</Badge>
                )}
              </div>

              {/* Progress Overview */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Latest Progress</span>
                    <span className="font-semibold">{latestProgress}%</span>
                  </div>
                  <Progress value={latestProgress} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Average Progress</span>
                    <span className="font-semibold">{avgProgress}%</span>
                  </div>
                  <Progress value={avgProgress} className="h-2" />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Department</label>
                  <p className="font-medium">{task.department.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created By</label>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={task.creator.avatarUrl || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(task.creator.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm">{task.creator.name || 'Unknown'}</span>
                  </div>
                </div>
                {task.dueDate && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Due Date</label>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <p className="font-medium text-sm">
                        {format(new Date(task.dueDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Hours</label>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <p className="font-medium text-sm">
                      {task.actualHours || 0} / {task.estimatedHours || '-'}h
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Assignees</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {task.assignees.map((assignee) => (
                    <div key={assignee.id} className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={assignee.user.avatarUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(assignee.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{assignee.user.name || 'Unknown'}</span>
                    </div>
                  ))}
                  {task.assignees.length === 0 && (
                    <span className="text-sm text-muted-foreground">No assignees</span>
                  )}
                </div>
              </div>

              {task.tags.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tags</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {task.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Updates Timeline */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Progress Updates ({updates.length})
                </h3>
              </div>

              {updatesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <TaskUpdateTimeline
                  updates={updates}
                  currentUserId={currentUser?.id}
                  onUpdate={handleUpdateEdit}
                  onDelete={handleUpdateDelete}
                  showActions={true}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AddUpdateDialog
        open={addUpdateOpen}
        onOpenChange={setAddUpdateOpen}
        taskId={task.id}
        existingUpdate={editingUpdate}
        onSuccess={handleUpdateAdded}
      />
    </>
  );
}
