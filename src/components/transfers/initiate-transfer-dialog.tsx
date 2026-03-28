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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { User, Calendar, Building2, Check, X } from 'lucide-react';
import { Task } from '@prisma/client';

interface User {
  id: string;
  name: string | null;
  email: string;
  employeeId: string | null;
  avatarUrl: string | null;
  deptId: string | null;
  department: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface UserTask {
  id: string;
  title: string;
  status: string;
}

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function InitiateTransferDialog({ onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  // Form data
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [targetDepartment, setTargetDepartment] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [reason, setReason] = useState('');

  // Task reassignment
  const [userTasks, setUserTasks] = useState<UserTask[]>([]);
  const [taskReassignments, setTaskReassignments] = useState<Record<string, string>>({});

  // Data lists
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [employeesRes, deptsRes] = await Promise.all([
        fetch('/api/employees?status=ACTIVE'),
        fetch('/api/departments'),
      ]);

      if (employeesRes.ok && deptsRes.ok) {
        const employeesData = await employeesRes.json();
        const deptsData = await deptsRes.json();

        setEmployees(employeesData.employees || []);
        setDepartments(deptsData.departments || []);
        setAvailableUsers(employeesData.employees || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    }
  };

  const handleEmployeeSelect = async (employee: User) => {
    setSelectedEmployee(employee);
    setTargetDepartment(''); // Reset target department
    setTaskReassignments({}); // Reset task reassignments

    // Fetch user's active tasks
    try {
      const response = await fetch(`/api/tasks?assignee=${employee.id}&status=IN_PROGRESS,TO_DO`);
      if (response.ok) {
        const data = await response.json();
        setUserTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Error fetching user tasks:', error);
    }
  };

  const handleTaskReassignment = (taskId: string, newAssigneeId: string) => {
    setTaskReassignments((prev) => ({
      ...prev,
      [taskId]: newAssigneeId,
    }));
  };

  const filteredEmployees = employees.filter(
    (emp) =>
      !searchTerm ||
      emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableDepartments = departments.filter(
    (dept) => dept.id !== selectedEmployee?.department?.id
  );

  const availableAssignees = availableUsers.filter(
    (user) => user.id !== selectedEmployee?.id && user.deptId === selectedEmployee?.deptId
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !targetDepartment || !effectiveDate || !reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedEmployee.id,
          fromDeptId: selectedEmployee.deptId,
          toDeptId: targetDepartment,
          effectiveDate,
          reason,
          taskReassignments: Object.keys(taskReassignments).length > 0 ? taskReassignments : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to initiate transfer');
      }

      toast.success('Transfer request initiated successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Error initiating transfer:', error);
      toast.error(error.message || 'Failed to initiate transfer');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const canProceedToStep2 = selectedEmployee && targetDepartment && effectiveDate && reason;
  const canSubmit = step === 2;

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {step === 1 ? 'Initiate Department Transfer' : 'Review Task Reassignments'}
        </DialogTitle>
        <DialogDescription>
          {step === 1
            ? 'Select an employee and provide transfer details'
            : 'Review and optionally reassign active tasks'}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        {step === 1 ? (
          <div className="space-y-4 py-4">
            {/* Employee Selection */}
            <div className="space-y-2">
              <Label>Employee *</Label>
              <div className="relative">
                <Input
                  placeholder="Search by name, email, or employee ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mb-2"
                />
                {searchTerm && filteredEmployees.length > 0 && (
                  <div className="absolute z-10 w-full border bg-background rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredEmployees.map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => {
                          handleEmployeeSelect(emp);
                          setSearchTerm('');
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-accent flex items-center gap-3"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={emp.avatarUrl || undefined} />
                          <AvatarFallback>{getInitials(emp.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-medium">{emp.name || 'Unknown'}</div>
                          <div className="text-sm text-muted-foreground">
                            {emp.employeeId || emp.email}
                          </div>
                        </div>
                        {emp.department && (
                          <Badge variant="outline">{emp.department.name}</Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedEmployee && (
                <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedEmployee.avatarUrl || undefined} />
                    <AvatarFallback>{getInitials(selectedEmployee.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium">{selectedEmployee.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedEmployee.employeeId || selectedEmployee.email}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedEmployee(null);
                      setTargetDepartment('');
                      setUserTasks([]);
                      setTaskReassignments({});
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Target Department */}
            <div className="space-y-2">
              <Label>Target Department *</Label>
              <Select
                value={targetDepartment}
                onValueChange={setTargetDepartment}
                disabled={!selectedEmployee}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target department" />
                </SelectTrigger>
                <SelectContent>
                  {availableDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Effective Date */}
            <div className="space-y-2">
              <Label>Effective Date *</Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label>Reason for Transfer *</Label>
              <Textarea
                placeholder="Provide a reason for this transfer..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {userTasks.length > 0 ? (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Building2 className="h-4 w-4" />
                  <span>
                    Employee has {userTasks.length} active task{userTasks.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {userTasks.map((task) => (
                  <div key={task.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="font-medium">{task.title}</h4>
                        <Badge variant="outline" className="mt-1">
                          {task.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Reassign to (optional):</Label>
                      <Select
                        value={taskReassignments[task.id] || ''}
                        onValueChange={(value) => handleTaskReassignment(task.id, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="No reassignment - keep with employee" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No reassignment - keep with employee</SelectItem>
                          {availableAssignees.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name || user.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-center py-8">
                <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Active Tasks</h3>
                <p className="text-muted-foreground">
                  The employee has no active tasks that need reassignment
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          {step === 1 ? (
            <Button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canProceedToStep2 || loading}
            >
              Next
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                disabled={loading}
              >
                Back
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Submitting...' : 'Initiate Transfer'}
              </Button>
            </>
          )}
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
