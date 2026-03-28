'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { UserRole, UserStatus } from '@prisma/client';
import {
  Search,
  Plus,
  Mail,
  Loader2,
  MoreVertical,
  UserPlus,
} from 'lucide-react';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, [deptFilter, roleFilter, statusFilter]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (deptFilter && deptFilter !== 'ALL') params.deptId = deptFilter;
      if (roleFilter && roleFilter !== 'ALL') params.role = roleFilter;
      if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter;
      if (search) params.search = search;

      const data = await api.getEmployees(params);
      setEmployees(data.data);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const employeeData = {
      email: formData.get('email') as string,
      name: formData.get('name') as string,
      role: formData.get('role') as UserRole,
      designation: formData.get('designation') as string,
      deptId: formData.get('deptId') as string,
    };

    try {
      setCreateLoading(true);
      await api.createEmployee(employeeData);
      setShowCreateDialog(false);
      fetchEmployees();
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      console.error('Failed to create employee:', error);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleInvite = async (employeeId: string) => {
    try {
      await api.inviteEmployee(employeeId);
      alert('Invitation sent successfully!');
    } catch (error) {
      console.error('Failed to send invitation:', error);
      alert('Failed to send invitation');
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

  const getRoleColor = (role: string) => {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-500/10 text-green-500';
      case 'INACTIVE':
        return 'bg-red-500/10 text-red-500';
      case 'PENDING':
        return 'bg-yellow-500/10 text-yellow-500';
      default:
        return 'bg-slate-500/10 text-slate-500';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team</h1>
            <p className="text-muted-foreground">
              Manage your organization's team members
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
                <DialogDescription>
                  Create a new employee account
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateEmployee} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input id="name" name="name" required placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" name="email" type="email" required placeholder="john@example.com" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Select name="role" required>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EMPLOYEE">Employee</SelectItem>
                        <SelectItem value="DEPT_MANAGER">Department Manager</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="designation">Designation</Label>
                    <Input id="designation" name="designation" placeholder="Software Engineer" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deptId">Department</Label>
                  <Select name="deptId">
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default-dept">Engineering</SelectItem>
                      {/* Add more departments dynamically */}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createLoading}>
                    {createLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Employee
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employees..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Departments</SelectItem>
                    <SelectItem value="default-dept">Engineering</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Roles</SelectItem>
                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="DEPT_MANAGER">Manager</SelectItem>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employee List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {employees.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="pt-6 text-center py-12">
                  <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No employees found</p>
                </CardContent>
              </Card>
            ) : (
              employees.map((employee) => (
                <Card key={employee.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={employee.avatarUrl || undefined} />
                        <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
                      </Avatar>
                      <Badge className={getRoleColor(employee.role)}>
                        {employee.role.replace('_', ' ')}
                      </Badge>
                    </div>
                    <h3 className="font-semibold mb-1">{employee.name || 'No Name'}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{employee.email}</p>
                    {employee.designation && (
                      <p className="text-sm mb-3">{employee.designation}</p>
                    )}
                    <div className="flex items-center gap-2 mb-4">
                      <Badge className={getStatusColor(employee.status)}>
                        {employee.status}
                      </Badge>
                      {employee.department && (
                        <span className="text-xs text-muted-foreground">
                          {employee.department.name}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <a href={`mailto:${employee.email}`}>
                          <Mail className="h-4 w-4 mr-1" />
                          Email
                        </a>
                      </Button>
                      {employee.status === 'PENDING' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleInvite(employee.id)}
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          Invite
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
