'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Building2, Users, CheckSquare, Save, AlertCircle, User, Bell, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserRole } from '@prisma/client';

interface OrganizationOwner {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  ownerId: string | null;
  settings: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  owner?: OrganizationOwner | null;
  _count: {
    users: number;
    departments: number;
    tasks: number;
  };
}

interface RoleTestUser {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  deptId: string | null;
}

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    avatarUrl: '',
  });

  // Organization form state
  const [orgForm, setOrgForm] = useState({
    name: '',
    slug: '',
  });

  // Notification preferences
  const [notifications, setNotifications] = useState({
    emailDigest: true,
    taskAssignments: true,
    statusChanges: true,
    dueReminders: true,
    mentions: true,
  });
  const [roleTestUsers, setRoleTestUsers] = useState<RoleTestUser[]>([]);
  const [roleTestDepts, setRoleTestDepts] = useState<DepartmentOption[]>([]);
  const [roleTestLoading, setRoleTestLoading] = useState(false);
  const [roleTestTargetId, setRoleTestTargetId] = useState('');
  const [roleTestRole, setRoleTestRole] = useState<UserRole>(UserRole.EMPLOYEE);
  const [roleTestDeptId, setRoleTestDeptId] = useState<string>('NONE');

  // Fetch user info
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setCurrentUser(data.user);
          setProfileForm({
            name: data.user.name || '',
            phone: data.user.phone || '',
            avatarUrl: data.user.avatarUrl || '',
          });

          // Load notification preferences
          const settings = JSON.parse(data.user.settings || '{}');
          setNotifications({
            emailDigest: settings.emailDigest !== false,
            taskAssignments: settings.taskAssignments !== false,
            statusChanges: settings.statusChanges !== false,
            dueReminders: settings.dueReminders !== false,
            mentions: settings.mentions !== false,
          });
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      }
    };
    fetchUser();
  }, []);

  // Fetch organization
  useEffect(() => {
    if (currentUser) {
      fetchOrganization();
    }
  }, [currentUser]);

  const fetchOrganization = async () => {
    if (!currentUser?.orgId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await fetch('/api/organizations');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load organization');
      }
      // SUPER_ADMIN gets { data: Organization[] }; everyone else gets { organization }
      let org: Organization | undefined = data.organization;
      if (!org && Array.isArray(data.data)) {
        org =
          data.data.find((o: Organization) => o.id === currentUser.orgId) ??
          data.data[0];
      }
      if (!org) {
        throw new Error('Organization not found');
      }
      setOrganization(org);
      setOrgForm({
        name: org.name,
        slug: org.slug,
      });
    } catch (error: any) {
      console.error('Failed to fetch organization:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load organization',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/employees/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Profile updated',
          description: 'Your profile has been updated successfully.',
        });
        setCurrentUser({ ...currentUser, ...data.employee });
      } else {
        throw new Error(data.error || 'Failed to update profile');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOrg = async () => {
    if (!organization) return;

    try {
      setSaving(true);
      const response = await fetch('/api/organizations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orgForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update organization');
      }

      toast({
        title: 'Organization updated',
        description: 'Organization settings have been updated successfully.',
      });

      setOrganization(data.organization);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update organization',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/employees/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: JSON.stringify(notifications),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Preferences saved',
          description: 'Your notification preferences have been updated.',
        });
      } else {
        throw new Error(data.error || 'Failed to update preferences');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update preferences',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const canEditOrg = currentUser?.role === UserRole.SUPER_ADMIN;
  const canRoleTest = currentUser?.role === UserRole.SUPER_ADMIN && process.env.NODE_ENV !== 'production';

  useEffect(() => {
    if (!canRoleTest) return;
    const fetchRoleTestData = async () => {
      try {
        setRoleTestLoading(true);
        const [usersRes, deptsRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/departments'),
        ]);
        const [usersData, deptsData] = await Promise.all([
          usersRes.json(),
          deptsRes.json(),
        ]);

        if (!usersRes.ok) {
          throw new Error(usersData.error || 'Failed to fetch users');
        }
        if (!deptsRes.ok) {
          throw new Error(deptsData.error || 'Failed to fetch departments');
        }

        const users = (usersData.users || []) as RoleTestUser[];
        const depts = (deptsData.departments || []) as DepartmentOption[];

        setRoleTestUsers(users);
        setRoleTestDepts(depts);

        if (users.length > 0) {
          const defaultTarget = users.find((u) => u.id === currentUser?.id) || users[0];
          setRoleTestTargetId(defaultTarget.id);
          setRoleTestRole(defaultTarget.role);
          setRoleTestDeptId(defaultTarget.deptId || 'NONE');
        }
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load role test data',
          variant: 'destructive',
        });
      } finally {
        setRoleTestLoading(false);
      }
    };

    fetchRoleTestData();
  }, [canRoleTest, currentUser?.id, toast]);

  const handleRoleTestTargetChange = (targetId: string) => {
    setRoleTestTargetId(targetId);
    const target = roleTestUsers.find((u) => u.id === targetId);
    if (!target) return;
    setRoleTestRole(target.role);
    setRoleTestDeptId(target.deptId || 'NONE');
  };

  const handleApplyRoleTest = async () => {
    if (!roleTestTargetId) return;
    try {
      setSaving(true);
      const response = await fetch(`/api/employees/${roleTestTargetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: roleTestRole,
          deptId: roleTestDeptId === 'NONE' ? null : roleTestDeptId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update role');
      }

      setRoleTestUsers((prev) =>
        prev.map((u) =>
          u.id === roleTestTargetId
            ? { ...u, role: roleTestRole, deptId: roleTestDeptId === 'NONE' ? null : roleTestDeptId }
            : u
        )
      );

      if (currentUser?.id === roleTestTargetId) {
        setCurrentUser((prev: any) => ({
          ...prev,
          role: roleTestRole,
          deptId: roleTestDeptId === 'NONE' ? null : roleTestDeptId,
        }));
      }

      toast({
        title: 'Role updated',
        description: 'Role test update applied. Re-login to validate final permissions.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to apply role test update',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

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
      <div className="max-w-full mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your profile and organization settings
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
            {canEditOrg && (
              <TabsTrigger value="organization">
                <Building2 className="h-4 w-4 mr-2" />
                Organization
              </TabsTrigger>
            )}
            {canRoleTest && (
              <TabsTrigger value="role-test">
                <Shield className="h-4 w-4 mr-2" />
                Role Testing
              </TabsTrigger>
            )}
          </TabsList>

          {/* Profile Settings */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your personal information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-6 mb-6">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={profileForm.avatarUrl || undefined} />
                    <AvatarFallback className="text-2xl">
                      {currentUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Profile photo (avatar URL)
                    </p>
                    <Input
                      value={profileForm.avatarUrl}
                      onChange={(e) => setProfileForm({ ...profileForm, avatarUrl: e.target.value })}
                      placeholder="https://example.com/avatar.jpg"
                      className="max-w-md"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={currentUser?.email || ''} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">Contact admin to change email</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveProfile} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" />
                    Save Profile
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* User Info */}
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Employee ID</Label>
                    <Input value={currentUser?.employeeId || 'N/A'} disabled className="font-mono text-xs" />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Input value={currentUser?.role || 'N/A'} disabled />
                  </div>
                  <div>
                    <Label>Department</Label>
                    <Input value={currentUser?.department?.name || 'N/A'} disabled />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Input value={currentUser?.status || 'N/A'} disabled />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Control how and when you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Digest</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive daily email digest of your tasks
                    </p>
                  </div>
                  <Switch
                    checked={notifications.emailDigest}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, emailDigest: checked })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Task Assignments</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when you're assigned to a task
                    </p>
                  </div>
                  <Switch
                    checked={notifications.taskAssignments}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, taskAssignments: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Status Changes</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when task status changes
                    </p>
                  </div>
                  <Switch
                    checked={notifications.statusChanges}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, statusChanges: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Due Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified before tasks are due
                    </p>
                  </div>
                  <Switch
                    checked={notifications.dueReminders}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, dueReminders: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>@Mentions</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when someone mentions you
                    </p>
                  </div>
                  <Switch
                    checked={notifications.mentions}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, mentions: checked })}
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveNotifications} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" />
                    Save Preferences
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Organization Settings */}
          {canEditOrg && (
            <TabsContent value="organization" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Organization Information</CardTitle>
                  <CardDescription>
                    Update your organization's basic information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="orgName">Organization Name *</Label>
                    <Input
                      id="orgName"
                      value={orgForm.name}
                      onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                      placeholder="e.g., Acme Corporation"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="orgSlug">Organization Slug *</Label>
                    <Input
                      id="orgSlug"
                      value={orgForm.slug}
                      onChange={(e) =>
                        setOrgForm({
                          ...orgForm,
                          slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                        })
                      }
                      placeholder="e.g., acme-corp"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used in URLs and login. Must contain only lowercase letters, numbers, and hyphens.
                    </p>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveOrg} disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Organization Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Organization Overview</CardTitle>
                  <CardDescription>
                    Quick statistics about your organization
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Plan</span>
                        <Badge variant="secondary">{organization?.plan || 'Free'}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Badge variant={organization?.isActive ? 'default' : 'destructive'}>
                          {organization?.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Users</span>
                        <span className="text-sm font-medium">{organization?._count.users || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Departments</span>
                        <span className="text-sm font-medium">{organization?._count.departments || 0}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Tasks</span>
                        <span className="text-sm font-medium">{organization?._count.tasks || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Owner</span>
                        <span className="text-sm font-medium">
                          {organization?.owner?.name || organization?.owner?.email || 'Not set'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canRoleTest && (
            <TabsContent value="role-test" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Role Testing (Dev Only)</CardTitle>
                  <CardDescription>
                    Quickly switch role/department for test users. Hidden in production builds.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                    Use this only for QA. If you change your own role, you may lose access to admin screens until another admin changes it back.
                  </div>

                  {roleTestLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading users and departments...
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2 md:col-span-2">
                          <Label>Test User</Label>
                          <Select value={roleTestTargetId} onValueChange={handleRoleTestTargetChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select user" />
                            </SelectTrigger>
                            <SelectContent>
                              {roleTestUsers.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {(u.name || u.email) + ' - ' + u.role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>New Role</Label>
                          <Select value={roleTestRole} onValueChange={(v) => setRoleTestRole(v as UserRole)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.values(UserRole) as UserRole[]).map((r) => (
                                <SelectItem key={r} value={r}>
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Department</Label>
                        <Select value={roleTestDeptId} onValueChange={setRoleTestDeptId}>
                          <SelectTrigger className="max-w-md">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE">No department</SelectItem>
                            {roleTestDepts.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name} ({d.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button onClick={handleApplyRoleTest} disabled={saving || !roleTestTargetId}>
                          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          <Shield className="mr-2 h-4 w-4" />
                          Apply Role Change
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
