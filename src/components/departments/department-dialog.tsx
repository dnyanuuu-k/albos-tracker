'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  parentId: string | null;
  managerId: string | null;
  isArchived: boolean;
}

interface DepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department?: Department;
  departments: Department[];
  users: User[];
  onSuccess: () => void;
}

export function DepartmentDialog({
  open,
  onOpenChange,
  department,
  departments,
  users,
  onSuccess,
}: DepartmentDialogProps) {
  const NO_PARENT = '__none_parent__';
  const NO_MANAGER = '__none_manager__';
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    parentId: '',
    managerId: '',
  });

  const { toast } = useToast();

  // Reset form when department changes
  useEffect(() => {
    if (department) {
      setFormData({
        name: department.name,
        code: department.code,
        description: department.description || '',
        parentId: department.parentId || '',
        managerId: department.managerId || '',
      });
    } else {
      setFormData({
        name: '',
        code: '',
        description: '',
        parentId: '',
        managerId: '',
      });
    }
  }, [department, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = department
        ? `/api/departments/${department.id}`
        : '/api/departments';
      const method = department ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code.toUpperCase(),
          description: formData.description || null,
          parentId: formData.parentId || null,
          managerId: formData.managerId || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save department');
      }

      toast({
        title: department ? 'Department updated' : 'Department created',
        description: department
          ? `${formData.name} has been updated successfully.`
          : `${formData.name} has been created successfully.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save department',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter departments to avoid circular references and self-selection
  const availableParentDepts = departments.filter(
    (d) => d.id !== department?.id && !d.isArchived
  );

  // Filter users for manager selection
  const availableManagers = users.filter((u) => u.role !== 'EMPLOYEE');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {department ? 'Edit Department' : 'Create New Department'}
          </DialogTitle>
          <DialogDescription>
            {department
              ? 'Update department details and settings.'
              : 'Add a new department to your organization.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Department Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Engineering"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="code">Department Code *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    code: e.target.value.toUpperCase(),
                  })
                }
                placeholder="e.g., ENG"
                required
              />
              <p className="text-xs text-muted-foreground">
                Must be uppercase letters, numbers, and hyphens only
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of the department"
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="parentId">Parent Department</Label>
              <Select
                value={formData.parentId || NO_PARENT}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    parentId: value === NO_PARENT ? '' : value,
                  })
                }
              >
                <SelectTrigger id="parentId">
                  <SelectValue placeholder="Select parent department (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>No parent (top-level)</SelectItem>
                  {availableParentDepts.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Department hierarchy (max 3 levels)
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="managerId">Department Manager</Label>
              <Select
                value={formData.managerId || NO_MANAGER}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    managerId: value === NO_MANAGER ? '' : value,
                  })
                }
              >
                <SelectTrigger id="managerId">
                  <SelectValue placeholder="Select manager (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MANAGER}>No manager assigned</SelectItem>
                  {availableManagers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}
                      <span className="text-muted-foreground ml-2">
                        ({user.role})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {department ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
