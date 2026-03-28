'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, User, Mail, Building2, Calendar, Briefcase, Edit2, Phone, RefreshCw, Check, X, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TransferStatus } from '@prisma/client';

interface Employee {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  employeeId: string | null;
  designation: string | null;
  employmentType: string | null;
  profileComplete: number;
  joinDate: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  department: {
    id: string;
    name: string;
    code: string;
  } | null;
  manager: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;
  directReports: Array<{
    id: string;
    name: string | null;
    email: string;
    role: string;
    status: string;
  }>;
  org: {
    id: string;
    name: string;
    slug: string;
  };
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface TransferHistory {
  id: string;
  status: TransferStatus;
  effectiveDate: string;
  reason: string | null;
  createdAt: string;
  fromDept: {
    name: string;
    code: string;
  };
  toDept: {
    name: string;
    code: string;
  };
  initiator: {
    name: string | null;
    email: string;
  };
}

export default function EmployeeProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const employeeId = params?.id || '';
  const NO_DEPARTMENT = '__no_department__';
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [transferHistory, setTransferHistory] = useState<TransferHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    designation: '',
    deptId: '',
    managerId: '',
    role: '',
    employmentType: '',
    status: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    if (!employeeId) return;
    fetchEmployee();
    fetchDepartments();
    fetchTransferHistory();
    fetchCurrentUser();
  }, [employeeId]);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
    }
  };

  const fetchEmployee = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/employees/${employeeId}`);
      if (response.ok) {
        const data = await response.json();
        setEmployee(data.employee);
        setEditForm({
          name: data.employee.name || '',
          phone: data.employee.phone || '',
          designation: data.employee.designation || '',
          deptId: data.employee.department?.id || '',
          managerId: data.employee.manager?.id || '',
          role: data.employee.role,
          employmentType: data.employee.employmentType || '',
          status: data.employee.status,
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load employee profile',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to fetch employee:', error);
      toast({
        title: 'Error',
        description: 'Failed to load employee profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments');
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const fetchTransferHistory = async () => {
    try {
      const response = await fetch(`/api/transfers?userId=${employeeId}`);
      if (response.ok) {
        const data = await response.json();
        setTransferHistory(data.transfers || []);
      }
    } catch (error) {
      console.error('Failed to fetch transfer history:', error);
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);

    try {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Employee updated successfully',
        });
        setEditDialogOpen(false);
        fetchEmployee();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to update employee',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to update employee:', error);
      toast({
        title: 'Error',
        description: 'Failed to update employee',
        variant: 'destructive',
      });
    } finally {
      setEditLoading(false);
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

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'ADMIN':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'DEPT_MANAGER':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default:
        return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'INACTIVE':
        return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
      case 'PENDING':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'SUSPENDED':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getTransferStatusColor = (status: TransferStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20';
      case 'APPROVED':
        return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20';
      case 'REJECTED':
        return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20';
      case 'CANCELLED':
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20';
      default:
        return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const canEdit =
    currentUser?.role === 'ADMIN' ||
    currentUser?.role === 'SUPER_ADMIN' ||
    (currentUser?.role === 'DEPT_MANAGER' &&
      currentUser?.deptId === employee?.department?.id);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!employee) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Employee not found</p>
          <Button variant="link" onClick={() => router.push('/team')}>
            Go back to Team
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
              onClick={() => router.push('/team')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{employee.name || 'Unknown User'}</h1>
              <p className="text-muted-foreground">{employee.email}</p>
            </div>
          </div>
          {canEdit && (
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Employee
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Employee</DialogTitle>
                  <DialogDescription>
                    Update employee information
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUpdateEmployee} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={editForm.phone}
                      onChange={(e) =>
                        setEditForm({ ...editForm, phone: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="designation">Designation</Label>
                    <Input
                      id="designation"
                      value={editForm.designation}
                      onChange={(e) =>
                        setEditForm({ ...editForm, designation: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="deptId">Department</Label>
                    <Select
                      value={editForm.deptId || NO_DEPARTMENT}
                      onValueChange={(value) =>
                        setEditForm({ ...editForm, deptId: value === NO_DEPARTMENT ? '' : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_DEPARTMENT}>No Department</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {currentUser?.role === 'ADMIN' ||
                  currentUser?.role === 'SUPER_ADMIN' ? (
                    <>
                      <div>
                        <Label htmlFor="role">Role</Label>
                        <Select
                          value={editForm.role}
                          onValueChange={(value) =>
                            setEditForm({ ...editForm, role: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EMPLOYEE">Employee</SelectItem>
                            <SelectItem value="DEPT_MANAGER">
                              Department Manager
                            </SelectItem>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                            <SelectItem value="SUPER_ADMIN">
                              Super Admin
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={editForm.status}
                          onValueChange={(value) =>
                            setEditForm({ ...editForm, status: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="INACTIVE">Inactive</SelectItem>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="SUSPENDED">Suspended</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="employmentType">Employment Type</Label>
                        <Select
                          value={editForm.employmentType}
                          onValueChange={(value) =>
                            setEditForm({ ...editForm, employmentType: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FULL_TIME">Full Time</SelectItem>
                            <SelectItem value="PART_TIME">Part Time</SelectItem>
                            <SelectItem value="CONTRACT">Contract</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : null}
                  <Button type="submit" className="w-full" disabled={editLoading}>
                    {editLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Basic information about {employee.name || 'this employee'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start gap-6">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={employee.avatarUrl || undefined} />
                    <AvatarFallback className="text-2xl">
                      {getInitials(employee.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <div>
                      <h3 className="text-2xl font-bold">
                        {employee.name || 'Unknown'}
                      </h3>
                      <p className="text-muted-foreground">{employee.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className={getRoleBadgeColor(employee.role)}
                      >
                        {employee.role.replace('_', ' ')}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={getStatusBadgeColor(employee.status)}
                      >
                        {employee.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Briefcase className="h-4 w-4" />
                      <span>Employee ID</span>
                    </div>
                    <p className="font-medium">
                      <code>{employee.employeeId || 'Not assigned'}</code>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>Designation</span>
                    </div>
                    <p className="font-medium">
                      {employee.designation || 'Not assigned'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      <span>Department</span>
                    </div>
                    <p className="font-medium">
                      {employee.department?.name || 'No Department'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Join Date</span>
                    </div>
                    <p className="font-medium">
                      {employee.joinDate
                        ? new Date(employee.joinDate).toLocaleDateString()
                        : 'Not set'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>Phone</span>
                    </div>
                    <p className="font-medium">
                      {employee.phone || 'Not provided'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>Email</span>
                    </div>
                    <p className="font-medium">{employee.email}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium mb-2">Profile Completeness</h4>
                  <Progress value={employee.profileComplete} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {employee.profileComplete}% complete
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Direct Reports */}
            {employee.directReports.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Direct Reports ({employee.directReports.length})</CardTitle>
                  <CardDescription>
                    Employees reporting to {employee.name || 'this employee'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {employee.directReports.map((report) => (
                      <div
                        key={report.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {getInitials(report.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {report.name || 'Unknown'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {report.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={getRoleBadgeColor(report.role)}
                          >
                            {report.role.replace('_', ' ')}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={getStatusBadgeColor(report.status)}
                          >
                            {report.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Transfer History */}
            {transferHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5" />
                    Transfer History ({transferHistory.length})
                  </CardTitle>
                  <CardDescription>
                    Department transfer requests for {employee.name || 'this employee'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {transferHistory.map((transfer) => (
                      <div
                        key={transfer.id}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Badge className={getTransferStatusColor(transfer.status)} variant="outline">
                                {transfer.status}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                Requested on {new Date(transfer.createdAt).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium text-red-600">{transfer.fromDept.name}</span>
                                <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium text-green-600">{transfer.toDept.name}</span>
                              </div>
                            </div>

                            {transfer.effectiveDate && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                                <Calendar className="h-3 w-3" />
                                Effective: {new Date(transfer.effectiveDate).toLocaleDateString()}
                              </div>
                            )}

                            {transfer.reason && (
                              <div className="text-sm mt-2">
                                <span className="text-muted-foreground">Reason: </span>
                                {transfer.reason}
                              </div>
                            )}

                            <div className="text-xs text-muted-foreground mt-2">
                              Initiated by {transfer.initiator.name || transfer.initiator.email}
                            </div>
                          </div>

                          {transfer.status === 'APPROVED' && (
                            <Check className="h-5 w-5 text-green-500" />
                          )}
                          {transfer.status === 'REJECTED' && (
                            <X className="h-5 w-5 text-red-500" />
                          )}
                          {transfer.status === 'PENDING' && (
                            <Clock className="h-5 w-5 text-yellow-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Manager */}
            {employee.manager && (
              <Card>
                <CardHeader>
                  <CardTitle>Manager</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {getInitials(employee.manager.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {employee.manager.name || 'Unknown'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {employee.manager.email}
                      </p>
                      <Badge
                        variant="outline"
                        className={getRoleBadgeColor(employee.manager.role)}
                      >
                        {employee.manager.role.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Organization */}
            <Card>
              <CardHeader>
                <CardTitle>Organization</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{employee.org.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Slug</p>
                  <p className="font-mono text-sm">{employee.org.slug}</p>
                </div>
              </CardContent>
            </Card>

            {/* Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Last Login</p>
                  <p className="font-medium">
                    {employee.lastLoginAt
                      ? new Date(employee.lastLoginAt).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="font-medium">
                    {new Date(employee.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
