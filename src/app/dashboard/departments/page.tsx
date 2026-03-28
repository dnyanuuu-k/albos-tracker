'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DepartmentDialog } from '@/components/departments/department-dialog';
import { DepartmentCard } from '@/components/departments/department-card';
import { Loader2, Plus, Search, Building2, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserRole } from '@prisma/client';

interface User {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
}

interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  parentId: string | null;
  managerId: string | null;
  manager?: {
    id: string;
    name: string | null;
    email: string;
    role: UserRole;
  } | null;
  parent?: {
    id: string;
    name: string;
    code: string;
  } | null;
  children?: {
    id: string;
    name: string;
    code: string;
  }[];
  _count: {
    users: number;
    tasks: number;
  };
  activeTaskCount: number;
}

export default function DepartmentsPage() {
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterParent, setFilterParent] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | undefined>();
  const [currentUser, setCurrentUser] = useState<any>(null);

  const { toast } = useToast();

  // Fetch user info
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setCurrentUser(data.user);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      }
    };
    fetchUser();
  }, []);

  // Fetch departments
  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/departments');
      const data = await response.json();
      if (response.ok) {
        setDepartments(data.departments);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load departments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch users (for manager selection)
  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        // For now, we'll just use the current user. In a real app, you'd fetch all users
        setUsers([data.user]);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchDepartments();
      fetchUsers();
    }
  }, [currentUser]);

  const handleCreateClick = () => {
    setEditingDepartment(undefined);
    setDialogOpen(true);
  };

  const handleEditClick = (department: Department) => {
    setEditingDepartment(department);
    setDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    fetchDepartments();
  };

  // Filter departments
  const filteredDepartments = departments.filter((dept) => {
    const matchesSearch =
      dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dept.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dept.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesParent =
      filterParent === 'all' ||
      (filterParent === 'none' && !dept.parentId) ||
      dept.parentId === filterParent;

    return matchesSearch && matchesParent;
  });

  // Get unique parent departments for filter
  const parentDepartments = departments.filter((d) => d.children && d.children.length > 0);

  // Check if user can create departments
  const canCreate =
    currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Departments</h1>
            <p className="text-muted-foreground mt-1">
              Manage your organization's departments and their structure
            </p>
          </div>
          {canCreate && (
            <Button onClick={handleCreateClick}>
              <Plus className="mr-2 h-4 w-4" />
              New Department
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Departments</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{departments.length}</div>
              <p className="text-xs text-muted-foreground">Active departments</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {departments.reduce((sum, d) => sum + d._count.users, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Across all departments</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {departments.reduce((sum, d) => sum + d.activeTaskCount, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Tasks in progress</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search departments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="w-full sm:w-[200px]">
                <Select value={filterParent} onValueChange={setFilterParent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by parent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    <SelectItem value="none">Top-level Only</SelectItem>
                    {parentDepartments.map((parent) => (
                      <SelectItem key={parent.id} value={parent.id}>
                        {parent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Departments Grid */}
        {filteredDepartments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No departments found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || filterParent !== 'all'
                  ? 'Try adjusting your filters or search query.'
                  : canCreate
                  ? 'Get started by creating your first department.'
                  : 'Departments will appear here once created by an admin.'}
              </p>
              {canCreate && !searchQuery && filterParent === 'all' && (
                <Button onClick={handleCreateClick}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Department
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredDepartments.map((department) => (
              <DepartmentCard
                key={department.id}
                department={department}
                currentUserRole={currentUser?.role || UserRole.EMPLOYEE}
                onEdit={() => handleEditClick(department)}
                onArchive={fetchDepartments}
                onDelete={fetchDepartments}
              />
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <DepartmentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          department={editingDepartment}
          departments={departments}
          users={users}
          onSuccess={handleDialogSuccess}
        />
      </div>
    </DashboardLayout>
  );
}
