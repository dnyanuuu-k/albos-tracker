'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Clock,
  Calendar,
  User,
  Building2,
  AlertCircle,
  Loader2,
  MessageSquare,
  TrendingUp,
  Edit2,
} from 'lucide-react';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [task, setTask] = useState<any>(null);
  const [updates, setUpdates] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Update form state
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateHours, setUpdateHours] = useState('');
  const [updateNote, setUpdateNote] = useState('');
  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  // Comment form state
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('MEDIUM');
  const [editEstimatedHours, setEditEstimatedHours] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const canEditTask = useMemo(() => {
    if (!task || !currentUser) return false;
    if (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') return true;
    if (currentUser.role === 'DEPT_MANAGER' && task.deptId === currentUser.deptId) return true;
    if (task.creatorId === currentUser.id) return true;
    return (
      task.assignees?.some(
        (a: { userId?: string; user?: { id?: string } }) =>
          a.userId === currentUser.id || a.user?.id === currentUser.id
      ) ?? false
    );
  }, [task, currentUser]);

  useEffect(() => {
    fetchTask();
    fetchCurrentUser();
  }, [taskId]);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
    }
  };

  const fetchTask = async () => {
    try {
      setLoading(true);
      const [taskRes, updatesRes, commentsRes] = await Promise.all([
        fetch(`/api/tasks/${taskId}`),
        fetch(`/api/tasks/${taskId}/updates`),
        fetch(`/api/tasks/${taskId}/comments`),
      ]);

      const taskData = await taskRes.json();
      const updatesData = await updatesRes.json();
      const commentsData = await commentsRes.json();

      if (taskRes.ok) {
        setTask(taskData.data || taskData);
      } else {
        setError(taskData.error || 'Failed to load task');
      }

      if (updatesRes.ok) {
        setUpdates(updatesData.data || updatesData.updates || []);
      }

      if (commentsRes.ok) {
        setComments(commentsData.data || commentsData.comments || []);
      }
    } catch (err) {
      console.error('Failed to fetch task:', err);
      setError('Failed to load task');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      setError('');
      const response = await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchTask();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update status');
      }
    } catch (err) {
      setError('Failed to update status');
    }
  };

  const openEditDialog = () => {
    if (!task) return;
    setEditTitle(task.title || '');
    setEditDescription(task.description || '');
    setEditDueDate(
      task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ''
    );
    setEditPriority(task.priority || 'MEDIUM');
    setEditEstimatedHours(
      task.estimatedHours != null ? String(task.estimatedHours) : ''
    );
    setEditOpen(true);
  };

  const handleSaveTaskDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      setError('Title is required');
      return;
    }
    setSavingEdit(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        title: editTitle.trim(),
        description: editDescription,
        priority: editPriority,
        dueDate: editDueDate ? editDueDate : null,
        estimatedHours:
          editEstimatedHours.trim() === ''
            ? undefined
            : parseFloat(editEstimatedHours),
      };
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        setEditOpen(false);
        fetchTask();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save task');
      }
    } catch {
      setError('Failed to save task');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSubmitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingUpdate(true);

    try {
      const response = await fetch(`/api/tasks/${taskId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          progress: updateProgress,
          hours: parseFloat(updateHours) || 0,
          note: updateNote,
        }),
      });

      if (response.ok) {
        setUpdateProgress(0);
        setUpdateHours('');
        setUpdateNote('');
        fetchTask();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to submit update');
      }
    } catch (err) {
      setError('Failed to submit update');
    } finally {
      setSubmittingUpdate(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmittingComment(true);

    try {
      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment }),
      });

      if (response.ok) {
        setNewComment('');
        fetchTask();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to post comment');
      }
    } catch (err) {
      setError('Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'IN_PROGRESS': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'IN_REVIEW': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'APPROVED': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'REJECTED': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'OVERDUE': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'ON_HOLD': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'text-red-500 bg-red-500/10';
      case 'HIGH': return 'text-orange-500 bg-orange-500/10';
      case 'MEDIUM': return 'text-yellow-500 bg-yellow-500/10';
      default: return 'text-slate-500 bg-slate-500/10';
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!task) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">{error || 'Task not found'}</p>
          <Button onClick={() => router.push('/dashboard/tasks')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tasks
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/dashboard/tasks')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{task.title}</h1>
              <p className="text-muted-foreground">Task ID: {taskId.slice(0, 8)}...</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEditTask && (
              <Button variant="outline" size="sm" onClick={openEditDialog}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit details
              </Button>
            )}
            <Badge className={getPriorityColor(task.priority)}>
              {task.priority}
            </Badge>
            <Badge className={getStatusColor(task.status)} variant="outline">
              {task.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-lg">
            <form onSubmit={handleSaveTaskDetails}>
              <DialogHeader>
                <DialogTitle>Edit task</DialogTitle>
                <DialogDescription>
                  Update title, description, due date, priority, and estimate.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-desc">Description</Label>
                  <Textarea
                    id="edit-desc"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-due">Due date</Label>
                    <Input
                      id="edit-due"
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-priority">Priority</Label>
                    <Select
                      value={editPriority}
                      onValueChange={(v) => setEditPriority(v as TaskPriority)}
                    >
                      <SelectTrigger id="edit-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="LOW">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-est">Estimated hours</Label>
                  <Input
                    id="edit-est"
                    type="number"
                    min={0}
                    step={0.5}
                    value={editEstimatedHours}
                    onChange={(e) => setEditEstimatedHours(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={savingEdit}>
                  {savingEdit ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Save'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Task Details */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {task.description || 'No description provided'}
                </p>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="updates">
              <TabsList>
                <TabsTrigger value="updates">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Updates ({updates.length})
                </TabsTrigger>
                <TabsTrigger value="comments">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Comments ({comments.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="updates" className="space-y-4">
                {/* Add Update Form */}
                <Card>
                  <CardHeader>
                    <CardTitle>Log Daily Update</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmitUpdate} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Progress (%)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={updateProgress}
                            onChange={(e) => setUpdateProgress(parseInt(e.target.value))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Hours Worked</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            value={updateHours}
                            onChange={(e) => setUpdateHours(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={updateNote}
                          onChange={(e) => setUpdateNote(e.target.value)}
                          placeholder="Progress notes, blockers, achievements..."
                          rows={3}
                        />
                      </div>
                      <Button type="submit" disabled={submittingUpdate}>
                        {submittingUpdate ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          'Submit Update'
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Updates List */}
                {updates.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center py-8">
                      <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground">No updates yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {updates.map((update) => (
                      <Card key={update.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <Avatar>
                              <AvatarFallback>
                                {getInitials(update.user?.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="font-medium">{update.user?.name || 'Unknown'}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(update.createdAt).toLocaleString()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-bold">{update.progress}%</p>
                                  <p className="text-sm text-muted-foreground">{update.hours}h</p>
                                </div>
                              </div>
                              {update.note && (
                                <p className="text-sm text-muted-foreground">{update.note}</p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="comments" className="space-y-4">
                {/* Add Comment Form */}
                <Card>
                  <CardContent className="pt-6">
                    <form onSubmit={handleSubmitComment} className="space-y-4">
                      <Textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Write a comment..."
                        rows={3}
                      />
                      <Button type="submit" disabled={submittingComment || !newComment.trim()}>
                        {submittingComment ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Posting...
                          </>
                        ) : (
                          'Post Comment'
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Comments List */}
                {comments.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center py-8">
                      <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground">No comments yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {comments.map((comment) => (
                      <Card key={comment.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <Avatar>
                              <AvatarFallback>
                                {getInitials(comment.user?.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="font-medium">{comment.user?.name || 'Unknown'}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(comment.createdAt).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <p className="text-sm">{comment.content}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={task.status}
                  onValueChange={handleUpdateStatus}
                  disabled={!canEditTask}
                >
                  <SelectTrigger>
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
              </CardContent>
            </Card>

            {/* Details */}
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {task.dueDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Due:</span>
                    <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                  </div>
                )}
                {task.department && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Department:</span>
                    <span>{task.department.name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Created by:</span>
                  <span>{task.creator?.name || 'Unknown'}</span>
                </div>
                {task.estimatedHours && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Est. Hours:</span>
                    <span>{task.estimatedHours}h</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Assignees */}
            <Card>
              <CardHeader>
                <CardTitle>Assignees</CardTitle>
              </CardHeader>
              <CardContent>
                {task.assignees && task.assignees.length > 0 ? (
                  <div className="space-y-2">
                    {task.assignees.map((assignee: any) => (
                      <div key={assignee.user.id} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {getInitials(assignee.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{assignee.user.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{assignee.user.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No assignees</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
