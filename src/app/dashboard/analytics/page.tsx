'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import {
  TrendingUp,
  Download,
  Loader2,
  BarChart3,
  PieChart,
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
  departmentStats: Array<{
    id: string;
    name: string;
    code: string;
    _count: {
      users: number;
      tasks: number;
    };
  }>;
  topPerformers: Array<{
    userId: string;
    name: string;
    email: string;
    updatesCount: number;
    totalHours: number;
  }>;
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));

      const data = await api.getAnalytics({
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      });
      setAnalytics(data.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      if (format === 'csv') {
        // Fetch full analytics data for CSV export
        const response = await fetch('/api/analytics?detailed=true');
        const data = await response.json();

        if (!response.ok || !data.data) {
          throw new Error('Failed to fetch analytics data');
        }

        // Create CSV content
        const csvRows = [];
        
        // Header row
        csvRows.push(['Metric', 'Value', 'Date Exported'].join(','));

        // Overview metrics
        const { overview, tasksByStatus, tasksByPriority } = data.data;
        csvRows.push(['Total Tasks', overview.totalTasks, new Date().toISOString()].join(','));
        csvRows.push(['Completed Tasks', overview.completedTasks, new Date().toISOString()].join(','));
        csvRows.push(['Overdue Tasks', overview.overdueTasks, new Date().toISOString()].join(','));
        csvRows.push(['Completion Rate', `${overview.completionRate}%`, new Date().toISOString()].join(','));

        // Tasks by status
        csvRows.push(['', '', ''].join(','));
        csvRows.push(['Tasks by Status', '', ''].join(','));
        tasksByStatus.forEach((item: any) => {
          csvRows.push([item.status, item.count, ''].join(','));
        });

        // Tasks by priority
        csvRows.push(['', '', ''].join(','));
        csvRows.push(['Tasks by Priority', '', ''].join(','));
        tasksByPriority.forEach((item: any) => {
          csvRows.push([item.priority, item.count, ''].join(','));
        });

        // Create and download CSV file
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // For PDF, we'll use window.print() as a simple solution
        // In production, you'd use jspdf or similar library
        window.print();
      }
    } catch (error) {
      console.error('Failed to export:', error);
      alert(`Failed to export as ${format.toUpperCase()}. Please try again.`);
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground">
              Track performance and team productivity
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => handleExport('csv')}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport('pdf')}>
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.overview.totalTasks || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                All tasks in selected period
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.overview.completedTasks || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Tasks completed successfully
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <BarChart3 className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.overview.overdueTasks || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Tasks past due date
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.overview.completionRate || 0}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Overall completion percentage
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tasks by Status */}
        <Card>
          <CardHeader>
            <CardTitle>Tasks by Status</CardTitle>
            <CardDescription>Distribution of tasks across different statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics?.tasksByStatus.map((item) => {
                const total = analytics.tasksByStatus.reduce((sum, t) => sum + t.count, 0);
                const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <div key={item.status}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{item.status.replace('_', ' ')}</span>
                      <span className="text-muted-foreground">
                        {item.count} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tasks by Priority */}
        <Card>
          <CardHeader>
            <CardTitle>Tasks by Priority</CardTitle>
            <CardDescription>Task distribution by priority level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {analytics?.tasksByPriority.map((item) => {
                const colors = {
                  CRITICAL: 'bg-red-500',
                  HIGH: 'bg-orange-500',
                  MEDIUM: 'bg-yellow-500',
                  LOW: 'bg-slate-500',
                };
                return (
                  <div key={item.priority} className="text-center p-4 border rounded-lg">
                    <div
                      className={`h-16 w-16 rounded-full mx-auto mb-2 ${colors[item.priority as keyof typeof colors] || 'bg-slate-500'} flex items-center justify-center text-white text-2xl font-bold`}
                    >
                      {item.count}
                    </div>
                    <div className="font-medium">{item.priority}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Department Stats */}
        {analytics?.departmentStats && analytics.departmentStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Department Performance</CardTitle>
              <CardDescription>Tasks and employees per department</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.departmentStats.map((dept) => (
                  <div key={dept.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-semibold">{dept.name}</h4>
                      <p className="text-sm text-muted-foreground">{dept.code}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{dept._count.tasks}</div>
                      <div className="text-xs text-muted-foreground">
                        {dept._count.users} members
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Performers */}
        {analytics?.topPerformers && analytics.topPerformers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top Performers</CardTitle>
              <CardDescription>Most active team members</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
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
