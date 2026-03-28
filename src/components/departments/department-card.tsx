'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowUpRight,
  Building2,
  Users,
  CheckSquare,
  MoreVertical,
  Edit,
  Archive,
  Trash2,
  User,
  FolderTree,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserRole } from '@prisma/client';

interface DepartmentManager {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
}

interface DepartmentParent {
  id: string;
  name: string;
  code: string;
}

interface DepartmentChildren {
  id: string;
  name: string;
  code: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  manager?: DepartmentManager | null;
  parent?: DepartmentParent | null;
  children?: DepartmentChildren[];
  _count: {
    users: number;
    tasks: number;
  };
  activeTaskCount: number;
}

interface DepartmentCardProps {
  department: Department;
  currentUserRole: UserRole;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function DepartmentCard({
  department,
  currentUserRole,
  onEdit,
  onArchive,
  onDelete,
}: DepartmentCardProps) {
  const { toast } = useToast();

  const canManage =
    currentUserRole === UserRole.SUPER_ADMIN ||
    currentUserRole === UserRole.ADMIN;

  const canEdit =
    canManage ||
    (currentUserRole === UserRole.DEPT_MANAGER && department.manager?.id);

  const handleArchive = async () => {
    try {
      const response = await fetch(`/api/departments/${department.id}/archive`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to archive department');
      }

      toast({
        title: 'Department archived',
        description: `${department.name} has been archived.`,
      });

      onArchive();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to archive department',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/departments/${department.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete department');
      }

      toast({
        title: 'Department deleted',
        description: `${department.name} has been deleted.`,
      });

      onDelete();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || data.suggestion || 'Failed to delete department',
        variant: 'destructive',
      });
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

  return (
    <Card className="group hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{department.name}</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {department.code}
                </Badge>
              </div>
              {department.parent && (
                <CardDescription className="flex items-center gap-1 mt-1">
                  <FolderTree className="h-3 w-3" />
                  {department.parent.name}
                </CardDescription>
              )}
            </div>
          </div>

          {(canManage || canEdit) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Department
                </DropdownMenuItem>
                {canManage && (
                  <>
                    <DropdownMenuItem onClick={handleArchive}>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive Department
                    </DropdownMenuItem>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Department
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete {department.name}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. The department will be permanently deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {department.description && (
          <CardDescription className="line-clamp-2">
            {department.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Manager */}
        {department.manager && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-medium">
              {getInitials(department.manager.name, department.manager.email)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {department.manager.name || department.manager.email}
              </p>
              <p className="text-xs text-muted-foreground">Manager</p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-semibold">
              <Users className="h-4 w-4 text-muted-foreground" />
              {department._count.users}
            </div>
            <p className="text-xs text-muted-foreground">Employees</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-semibold">
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
              {department.activeTaskCount}
            </div>
            <p className="text-xs text-muted-foreground">Active Tasks</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-semibold">
              <FolderTree className="h-4 w-4 text-muted-foreground" />
              {department.children?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Sub-depts</p>
          </div>
        </div>

        {/* Sub-departments */}
        {department.children && department.children.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Sub-departments:</p>
            <div className="flex flex-wrap gap-1">
              {department.children.map((child) => (
                <Badge key={child.id} variant="secondary" className="text-xs">
                  {child.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href={`/dashboard/departments/${department.id}`}>
            <ArrowUpRight className="mr-2 h-4 w-4" />
            Open department hub
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
