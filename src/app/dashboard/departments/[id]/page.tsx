'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Users,
  CheckSquare,
  Building2,
  Loader2,
  AlertCircle,
  ArrowUpRight,
  UserPlus,
  MoreHorizontal,
  ExternalLink,
  ListTodo,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserRole } from '@prisma/client';

type TaskBuckets = {
  assigned: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
  cancelled: number;
};

type MemberRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  avatarUrl: string | null;
  employeeId: string | null;
  designation: string | null;
  taskStats: TaskBuckets;
};

export default function DepartmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deptId = params.id as string;
  const { toast } = useToast();

  const [department, setDepartment] = useState<any>(null);
  const [deptTaskStats, setDeptTaskStats] = useState<TaskBuckets | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [orgUsers, setOrgUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/departments/${deptId}/overview`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load department');
        setDepartment(null);
        return;
      }
      setDepartment(data.department);
      setDeptTaskStats(data.departmentTaskStats);
      setMembers(data.members || []);
      setRecentTasks(data.recentTasks || []);
    } catch {
      setError('Failed to load department');
    } finally {
      setLoading(false);
    }
  }, [deptId]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setCurrentUser(d.user);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const canManageMembers =
    currentUser?.role === UserRole.ADMIN ||
    currentUser?.role === UserRole.SUPER_ADMIN;

  const canRemoveMember =
    canManageMembers ||
    (currentUser?.role === UserRole.DEPT_MANAGER &&
      currentUser?.deptId === deptId);

  const openAddMember = async () => {
    setSelectedUserId('');
    setAddOpen(true);
    try {
      const r = await fetch('/api/employees?limit=500');
      const data = await r.json();
      const list = data.data || data.employees || [];
      const others = list.filter(
        (u: any) => u.deptId !== deptId && u.orgId === currentUser?.orgId
      );
      setOrgUsers(others.length ? others : list.filter((u: any) => u.deptId !== deptId));
    } catch {
      toast({ title: 'Error', description: 'Could not load users', variant: 'destructive' });
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    setAddLoading(true);
    try {
      const res = await fetch(`/api/employees/${selectedUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deptId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add member');
      toast({ title: 'Member added', description: 'They are now in this department.' });
      setAddOpen(false);
      fetchOverview();
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.message || 'Failed to add member',
        variant: 'destructive',
      });
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeTarget) return;
    setRemoveLoading(true);
    try {
      const res = await fetch(`/api/employees/${removeTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deptId: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove');
      toast({ title: 'Removed', description: `${removeTarget.name || removeTarget.email} was removed from this department.` });
      setRemoveTarget(null);
      fetchOverview();
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.message || 'Failed to remove member',
        variant: 'destructive',
      });
    } finally {
      setRemoveLoading(false);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const completionPct = (s: TaskBuckets) => {
    if (s.assigned === 0) return 0;
    return Math.round((s.completed / s.assigned) * 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'IN_PROGRESS':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'IN_REVIEW':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      default:
        return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
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

  if (!department) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 max-w-lg mx-auto">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">{error || 'Department not found'}</p>
          <Button onClick={() => router.push('/dashboard/departments')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Departments
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const d = deptTaskStats!;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-full space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/departments')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{department.name}</h1>
              <p className="text-muted-foreground text-sm">
                Code <span className="font-mono">{department.code}</span>
                {department.isArchived && (
                  <Badge variant="secondary" className="ml-2">
                    Archived
                  </Badge>
                )}
              </p>
              {department.description && (
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{department.description}</p>
              )}
            </div>
          </div>
          {canManageMembers && (
            <Button onClick={openAddMember}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add member
            </Button>
          )}
        </div>

        {/* Department roll-up */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{members.length}</div>
              <p className="text-xs text-muted-foreground">In this department</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Dept tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{d.assigned}</div>
              <p className="text-xs text-muted-foreground">Total in this department</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{d.completed}</div>
              <p className="text-xs text-muted-foreground">Done</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Needs attention</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{d.overdue + d.pending}</div>
              <p className="text-xs text-muted-foreground">Overdue + to do</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Workload snapshot</CardTitle>
            <CardDescription>Task distribution for this department (by assignee)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Completed vs total (dept)</span>
              <span className="font-medium">
                {d.completed} / {d.assigned || 1}
              </span>
            </div>
            <Progress
              value={d.assigned ? Math.round((d.completed / d.assigned) * 100) : 0}
              className="h-2"
            />
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2 text-center text-xs">
              <div>
                <div className="font-semibold text-green-600">{d.completed}</div>
                <div className="text-muted-foreground">Done</div>
              </div>
              <div>
                <div className="font-semibold text-blue-600">{d.inProgress}</div>
                <div className="text-muted-foreground">Active</div>
              </div>
              <div>
                <div className="font-semibold text-slate-600">{d.pending}</div>
                <div className="text-muted-foreground">To do</div>
              </div>
              <div>
                <div className="font-semibold text-red-600">{d.overdue}</div>
                <div className="text-muted-foreground">Overdue</div>
              </div>
              <div>
                <div className="font-semibold text-muted-foreground">{d.cancelled}</div>
                <div className="text-muted-foreground">Cancelled</div>
              </div>
              <div>
                <div className="font-semibold">{d.inProgress + d.pending}</div>
                <div className="text-muted-foreground">Open</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Members table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team members
              </CardTitle>
              <CardDescription>People assigned to this department with task progress</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No members yet. {canManageMembers ? 'Use Add member to assign someone.' : ''}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Assigned</TableHead>
                    <TableHead className="text-right">Done</TableHead>
                    <TableHead className="text-right">Active</TableHead>
                    <TableHead className="text-right">Overdue</TableHead>
                    <TableHead className="min-w-[140px]">Progress</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => {
                    const s = m.taskStats;
                    const pct = completionPct(s);
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={m.avatarUrl || undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(m.name, m.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <button
                                type="button"
                                className="font-medium text-left hover:underline truncate block"
                                onClick={() => router.push(`/team/${m.id}`)}
                              >
                                {m.name || 'Unknown'}
                              </button>
                              <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                              <div className="flex gap-1 mt-1">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {m.role.replace('_', ' ')}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {m.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{s.assigned}</TableCell>
                        <TableCell className="text-right tabular-nums text-green-600">{s.completed}</TableCell>
                        <TableCell className="text-right tabular-nums text-blue-600">
                          {s.inProgress + s.pending}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-red-600">{s.overdue}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => router.push(`/team/${m.id}`)}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(
                                    `/dashboard/tasks?deptId=${deptId}&assigneeId=${m.id}`
                                  )
                                }
                              >
                                <ListTodo className="mr-2 h-4 w-4" />
                                Their tasks
                              </DropdownMenuItem>
                              {canRemoveMember && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setRemoveTarget(m)}
                                >
                                  Remove from department
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Recent department tasks
            </CardTitle>
            <CardDescription>Latest updates in this department</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No tasks yet</p>
            ) : (
              <div className="divide-y rounded-lg border">
                {recentTasks.map((task: any) => (
                  <button
                    key={task.id}
                    type="button"
                    className="flex w-full items-start justify-between gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm line-clamp-1">{task.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {task.assignees?.map((a: any) => a.user?.name || a.user?.email).filter(Boolean).join(', ') ||
                          'Unassigned'}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge variant="outline" className={`text-[10px] ${getStatusColor(task.status)}`}>
                          {task.status.replace('_', ' ')}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground mt-1" />
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/tasks?deptId=${deptId}`}>All department tasks</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add member</DialogTitle>
              <DialogDescription>
                Assign an existing organization member to this department. Their previous department assignment
                will be replaced.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user" />
                </SelectTrigger>
                <SelectContent>
                  {orgUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.email} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddMember} disabled={!selectedUserId || addLoading}>
                {addLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove from department?</AlertDialogTitle>
              <AlertDialogDescription>
                {removeTarget?.name || removeTarget?.email} will no longer be listed under {department.name}. You
                can assign them again later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemoveMember} disabled={removeLoading}>
                {removeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
