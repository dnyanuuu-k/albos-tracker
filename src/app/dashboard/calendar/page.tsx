'use client';

import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DayPicker } from 'react-day-picker';
import { Calendar, Clock, Loader2, AlertCircle } from 'lucide-react';
import 'react-day-picker/dist/style.css';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  department?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

const priorityColor: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
  HIGH: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  MEDIUM: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  LOW: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
};

const statusColor: Record<string, string> = {
  TO_DO: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  IN_REVIEW: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
  APPROVED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  COMPLETED: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  REJECTED: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
  ON_HOLD: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  OVERDUE: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
  CANCELLED: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20',
};

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export default function DashboardCalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/tasks?limit=200');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load calendar');
        }

        setTasks((data.data || []).filter((t: Task) => !!t.dueDate));
      } catch (e: any) {
        setError(e.message || 'Failed to load calendar');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const key = dateKey(new Date(task.dueDate));
      map.set(key, [...(map.get(key) || []), task]);
    }
    return map;
  }, [tasks]);

  const highlightedDays = useMemo(
    () => Array.from(tasksByDate.keys()).map((k) => new Date(`${k}T00:00:00`)),
    [tasksByDate]
  );

  const selectedTasks = useMemo(() => {
    if (!selectedDay) return [];
    return tasksByDate.get(dateKey(selectedDay)) || [];
  }, [selectedDay, tasksByDate]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
            <p className="text-muted-foreground">{error}</p>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground mt-1">Track task due dates by day.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px,1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Due Date Calendar
              </CardTitle>
              <CardDescription>
                {highlightedDays.length} day{highlightedDays.length !== 1 ? 's' : ''} with due tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DayPicker
                mode="single"
                selected={selectedDay}
                onSelect={setSelectedDay}
                modifiers={{ hasTasks: highlightedDays }}
                modifiersClassNames={{
                  hasTasks: 'bg-primary/15 text-primary font-semibold rounded-md',
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Tasks Due{' '}
                {selectedDay
                  ? selectedDay.toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : ''}
              </CardTitle>
              <CardDescription>
                {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} scheduled
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks due on this date.</p>
              ) : (
                <div className="space-y-3">
                  {selectedTasks.map((task) => (
                    <div key={task.id} className="border rounded-lg p-3">
                      <div className="font-medium">{task.title}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={priorityColor[task.priority] || priorityColor.MEDIUM}
                        >
                          {task.priority}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={statusColor[task.status] || statusColor.TO_DO}
                        >
                          {task.status.replace('_', ' ')}
                        </Badge>
                        {task.department?.name && (
                          <Badge variant="outline">{task.department.name}</Badge>
                        )}
                        <span className="inline-flex items-center text-xs text-muted-foreground ml-auto">
                          <Clock className="h-3 w-3 mr-1" />
                          {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

