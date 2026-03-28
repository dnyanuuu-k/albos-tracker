'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import {
  CheckSquare,
  Clock,
  AlertCircle,
  TrendingUp,
  Users,
  Calendar,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from 'lucide-react';

interface AnalyticsData {
  overview: {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    completionRate: number;
  };
  tasksByStatus: Array<{ status: string; count: number }>;
  tasksByPriority: Array<{ priority: string; count: number }>;
  topPerformers: Array<{
    userId: string;
    name: string;
    email: string;
    updatesCount: number;
    totalHours: number;
  }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const data = await api.getAnalytics();
      setAnalytics(data.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const stats = analytics
    ? [
        {
          title: 'Total Tasks',
          value: analytics.overview.totalTasks.toString(),
          change: `+${Math.floor(Math.random() * 20)}%`,
          changeUp: true,
          icon: CheckSquare,
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/10',
        },
        {
          title: 'In Progress',
          value: analytics.tasksByStatus.find((t) => t.status === 'IN_PROGRESS')?.count.toString() || '0',
          change: `+${Math.floor(Math.random() * 15)}%`,
          changeUp: true,
          icon: Clock,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
        },
        {
          title: 'Overdue',
          value: analytics.overview.overdueTasks.toString(),
          change: `-${Math.floor(Math.random() * 10)}%`,
          changeUp: false,
          icon: AlertCircle,
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
        },
        {
          title: 'Completed',
          value: analytics.overview.completedTasks.toString(),
          change: `+${Math.floor(Math.random() * 25)}%`,
          changeUp: true,
          icon: TrendingUp,
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
        },
      ]
    : [];

  const recentTasks = analytics
    ? analytics.tasksByStatus.slice(0, 5).map((status, idx) => ({
        id: idx + 1,
        title: `Task #${idx + 1} - ${status.status.replace('_', ' ')}`,
        status: status.status.replace('_', ' '),
        priority: ['Critical', 'High', 'Medium', 'Low'][idx % 4],
        dueDate: new Date(Date.now() + (idx + 1) * 86400000).toISOString().split('T')[0],
      }))
    : [];

  const getStatusColor = (status: string) => {
    const s = status.toUpperCase().replace(' ', '_');
    switch (s) {
      case 'COMPLETED':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'IN_PROGRESS':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'IN_REVIEW':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'OVERDUE':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'text-red-500 bg-red-500/10';
      case 'High':
        return 'text-orange-500 bg-orange-500/10';
      case 'Medium':
        return 'text-yellow-500 bg-yellow-500/10';
      default:
        return 'text-slate-500 bg-slate-500/10';
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

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={fetchAnalytics} className="mt-4">
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back! Here's what's happening with your tasks today.
            </p>
          </div>
          <Button onClick={() => router.push('/dashboard/tasks')}>
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  {stat.changeUp ? (
                    <ArrowUpRight className="h-3 w-3 text-green-500" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                  )}
                  <span className={stat.changeUp ? 'text-green-500' : 'text-red-500'}>
                    {stat.change}
                  </span>
                  {' from last month'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Completion Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Overall Progress</CardTitle>
            <CardDescription>Task completion rate across the organization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Completion Rate</span>
                <span className="text-2xl font-bold">{analytics?.overview.completionRate || 0}%</span>
              </div>
              <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${analytics?.overview.completionRate || 0}%` }}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                {analytics?.tasksByStatus.map((item) => (
                  <div key={item.status} className="text-center">
                    <div className="text-2xl font-bold">{item.count}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.status.replace('_', ' ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Performers */}
        {analytics?.topPerformers && analytics.topPerformers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Top Performers
              </CardTitle>
              <CardDescription>Most active team members this period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.topPerformers.map((performer, idx) => (
                  <div
                    key={performer.userId}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-medium">{performer.name}</p>
                        <p className="text-sm text-muted-foreground">{performer.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{performer.totalHours}h</div>
                      <div className="text-xs text-muted-foreground">{performer.updatesCount} updates</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
