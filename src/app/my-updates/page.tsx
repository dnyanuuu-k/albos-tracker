'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { TaskUpdateTimeline } from '@/components/updates/task-update-timeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Calendar, Clock, TrendingUp, Activity } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

interface TaskUpdate {
  id: string;
  progress: number;
  hours: number;
  note: string | null;
  blockers: string[];
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  task: {
    id: string;
    title: string;
    status: string;
    department: {
      name: string;
    };
  };
}

interface UpdateSummary {
  totalUpdates: number;
  totalHours: number;
  averageProgress: number;
}

export default function MyUpdatesPage() {
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [summary, setSummary] = useState<UpdateSummary>({
    totalUpdates: 0,
    totalHours: 0,
    averageProgress: 0,
  });
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchUpdates();
    }
  }, [currentUser]);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        // /api/auth/me returns { success, user } — not the user at the top level
        if (data.user?.id) {
          setCurrentUser({ id: data.user.id });
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      setLoading(false);
    }
  };

  const fetchUpdates = async () => {
    if (!currentUser?.id) return;

    try {
      setLoading(true);
      const response = await fetch('/api/my-updates?limit=100');
      if (response.ok) {
        const data = await response.json();
        setUpdates(data.updates);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch updates:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUpdatesForPeriod = (period: 'today' | 'week' | 'month') => {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = startOfWeek(now);
        break;
      case 'month':
        startDate = startOfMonth(now);
        break;
    }

    return updates.filter((u) => new Date(u.createdAt) >= startDate);
  };

  const calculatePeriodStats = (periodUpdates: TaskUpdate[]) => {
    return {
      count: periodUpdates.length,
      hours: periodUpdates.reduce((sum, u) => sum + u.hours, 0),
      avgProgress: periodUpdates.length > 0
        ? Math.round(periodUpdates.reduce((sum, u) => sum + u.progress, 0) / periodUpdates.length)
        : 0,
    };
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'IN_PROGRESS':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'TO_DO':
        return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const todayStats = calculatePeriodStats(getUpdatesForPeriod('today'));
  const weekStats = calculatePeriodStats(getUpdatesForPeriod('week'));
  const monthStats = calculatePeriodStats(getUpdatesForPeriod('month'));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">My Updates</h1>
          <p className="text-muted-foreground mt-1">
            Track your daily progress and task updates
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Updates</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayStats.count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {todayStats.hours}h worked • {todayStats.avgProgress}% avg progress
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{weekStats.count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {weekStats.hours}h worked • {weekStats.avgProgress}% avg progress
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{monthStats.count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {monthStats.hours}h worked • {monthStats.avgProgress}% avg progress
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalHours}h</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across {summary.totalUpdates} updates
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Average Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Average Overall Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Progress value={summary.averageProgress} className="h-3" />
              </div>
              <div className="text-2xl font-bold w-16 text-right">
                {summary.averageProgress}%
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Updates by Period */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Updates</TabsTrigger>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {updates.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No updates yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Start adding progress updates to your tasks
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {updates.map((update) => (
                  <Card key={update.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{update.task.title}</h3>
                            <Badge className={getTaskStatusColor(update.task.status)}>
                              {update.task.status.replace('_', ' ')}
                            </Badge>
                            <Badge variant="outline">{update.task.department.name}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(update.createdAt), 'MMM d, yyyy • h:mm a')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {update.hours}h
                            </span>
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              {update.progress}%
                            </span>
                          </div>
                          {update.note && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {update.note}
                            </p>
                          )}
                          {update.blockers && update.blockers.length > 0 && (
                            <div className="mt-2">
                              <span className="text-xs font-semibold text-orange-600">
                                Blockers: {update.blockers.length}
                              </span>
                            </div>
                          )}
                        </div>
                        <Progress value={update.progress} className="w-20" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="today">
            <TaskUpdateTimeline
              updates={getUpdatesForPeriod('today')}
              currentUserId={currentUser?.id}
            />
          </TabsContent>

          <TabsContent value="week">
            <TaskUpdateTimeline
              updates={getUpdatesForPeriod('week')}
              currentUserId={currentUser?.id}
            />
          </TabsContent>

          <TabsContent value="month">
            <TaskUpdateTimeline
              updates={getUpdatesForPeriod('month')}
              currentUserId={currentUser?.id}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
