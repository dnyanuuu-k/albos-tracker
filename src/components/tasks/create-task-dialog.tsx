'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Calendar, Clock } from 'lucide-react';
import { TaskPriority, TaskStatus } from '@/types/task';
import { TaskAssignee } from '@/types/task';

interface CreateTaskDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
}

interface User {
  id: string;
  name: string | null;
  email: string;
  avatarUrl?: string | null;
  deptId?: string | null;
  status?: string;
  role?: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

export default function CreateTaskDialog({ open, onOpenChange, onSuccess }: CreateTaskDialogProps) {
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string; deptId: string | null } | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [status, setStatus] = useState<TaskStatus>('TO_DO');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [deptId, setDeptId] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');

  const isEmployee = currentUser?.role === 'EMPLOYEE';

  useEffect(() => {
    // Determine current user role so we can enforce correct assignment rules in UI.
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) return;
        const data = await response.json();
        setCurrentUser(data.user);
      } catch (error) {
        console.error('Failed to fetch current user:', error);
      }
    };

    fetchCurrentUser();
  }, []);

  useEffect(() => {
    // Employees can only create self-assigned tasks.
    if (!currentUser) return;
    if (!isEmployee) return;

    setDeptId(currentUser.deptId || '');
    setAssigneeIds([currentUser.id]);
  }, [currentUser, isEmployee]);

  useEffect(() => {
    // When Admin/Super Admin selects a department, reset assignee selections
    // and show only that department's active members as selectable options.
    if (!currentUser) return;
    if (isEmployee) return;
    if (!deptId) return;

    // Department selection should only affect the assignees *options*.
    // Task assignment happens only for assignees explicitly selected by the user.
    // Reset current selections when department changes.
    setAssigneeIds([]);
    setUserSearch('');
  }, [deptId, currentUser, isEmployee]);

  useEffect(() => {
    fetchDepartments();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (userSearch) {
      setFilteredUsers(
        users
          .filter((u) => (deptId ? u.deptId === deptId : true))
          .filter((u) => u.status === 'ACTIVE')
          .filter(
            (u) =>
              u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
              u.email.toLowerCase().includes(userSearch.toLowerCase())
          )
      );
    } else {
      setFilteredUsers(users.filter((u) => (deptId ? u.deptId === deptId : true)).filter((u) => u.status === 'ACTIVE'));
    }
  }, [userSearch, users, deptId]);

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments');
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setFilteredUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleAddAssignee = (userId: string) => {
    if (isEmployee) return;

    // Safety: only allow selecting users from the currently selected department.
    const user = users.find((u) => u.id === userId);
    if (!user || !deptId || user.deptId !== deptId) return;

    if (!assigneeIds.includes(userId)) {
      setAssigneeIds([...assigneeIds, userId]);
    }
    setUserSearch('');
  };

  const handleRemoveAssignee = (userId: string) => {
    if (isEmployee) return;
    setAssigneeIds(assigneeIds.filter((id) => id !== userId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || undefined,
          priority,
          status,
          dueDate: dueDate || undefined,
          estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
          category: category || undefined,
          tags: tags.length ? JSON.stringify(tags) : undefined,
          deptId,
          assigneeIds,
        }),
      });

      if (response.ok) {
        // Reset form
        setTitle('');
        setDescription('');
        setPriority('MEDIUM');
        setStatus('TO_DO');
        setDueDate('');
        setEstimatedHours('');
        setCategory('');
        setTags([]);
        setDeptId('');
        setAssigneeIds([]);

        if (onOpenChange) onOpenChange(false);
        if (onSuccess) onSuccess();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create task');
      }
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('Failed to create task');
    } finally {
      setLoading(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter task title"
                  required
                />
              </div>

              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={(value: TaskPriority) => setPriority(value)}>
                  <SelectTrigger id="priority">
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

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(value: TaskStatus) => setStatus(value)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TO_DO">To Do</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="IN_REVIEW">In Review</SelectItem>
                    <SelectItem value="ON_HOLD">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="department">Department *</Label>
                <Select value={deptId} onValueChange={setDeptId} required disabled={isEmployee}>
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="estimatedHours">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Estimated Hours
                  </div>
                </Label>
                <Input
                  id="estimatedHours"
                  type="number"
                  step="0.5"
                  min="0"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  placeholder="0"
                />
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g., Development, Design"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter task description"
                  rows={4}
                />
              </div>

              <div className="col-span-2">
                <Label>Tags</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Add a tag"
                  />
                  <Button type="button" variant="outline" onClick={handleAddTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => handleRemoveTag(tag)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="col-span-2">
                <Label>Assignees</Label>
                <Input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users to assign"
                  className="mt-1"
                  disabled={isEmployee}
                />
                {filteredUsers.length > 0 && (
                  <div className="border rounded-md mt-2 max-h-32 overflow-y-auto">
                    {filteredUsers.slice(0, 50).map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-2 p-2 hover:bg-muted cursor-pointer"
                        onClick={() => handleAddAssignee(user.id)}
                      >
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">
                          {getInitials(user.name)}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{user.name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {assigneeIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {assigneeIds.map((userId) => {
                      const user = users.find((u) => u.id === userId);
                      return (
                        <Badge key={userId} variant="secondary" className="gap-1">
                          {user?.name || 'Unknown'}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => handleRemoveAssignee(userId)}
                          />
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !title || !deptId || (!isEmployee && assigneeIds.length === 0)}
            >
              {loading ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
