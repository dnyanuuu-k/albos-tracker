"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  UserPlus,
  MoreVertical,
  Search,
  Filter,
  User,
  Mail,
  Building2,
  Calendar,
  AlertCircle,
  Check,
  X,
  Download,
  Upload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Employee {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  employeeId: string | null;
  designation: string | null;
  department: {
    id: string;
    name: string;
    code: string;
  } | null;
  manager: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  profileComplete: number;
  joinDate: string | null;
  createdAt: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

export default function TeamPage() {
  const router = useRouter();
  const ALL_FILTER = "ALL";
  const NO_DEPARTMENT = "__no_department__";
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [bulkInviteDialogOpen, setBulkInviteDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();

  // Invite form state
  const [inviteForm, setInviteForm] = useState({
    email: "",
    name: "",
    role: "EMPLOYEE",
    deptId: "",
    employmentType: "FULL_TIME",
  });
  const [inviteLoading, setInviteLoading] = useState(false);

  // Bulk invite form state
  const [csvData, setCsvData] = useState("");
  const [bulkInviteLoading, setBulkInviteLoading] = useState(false);
  const [bulkInviteResults, setBulkInviteResults] = useState<any>(null);

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [search, filterDept, filterRole, filterStatus]);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
      }
    } catch (error) {
      console.error("Failed to fetch current user:", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (filterDept && filterDept !== ALL_FILTER)
        params.append("deptId", filterDept);
      if (filterRole && filterRole !== ALL_FILTER) params.append("role", filterRole);
      if (filterStatus && filterStatus !== ALL_FILTER)
        params.append("status", filterStatus);

      const response = await fetch(`/api/employees?${params}`);
      if (response.ok) {
        const data = await response.json();
        // Support both legacy and current response envelopes.
        setEmployees(data.employees || data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch employees:", error);
      toast({
        title: "Error",
        description: "Failed to load employees",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);

    try {
      const response = await fetch("/api/employees/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: "Invitation sent successfully",
        });
        setInviteDialogOpen(false);
        setInviteForm({
          email: "",
          name: "",
          role: "EMPLOYEE",
          deptId: "",
          employmentType: "FULL_TIME",
        });
        fetchEmployees();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to send invitation",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to invite employee:", error);
      toast({
        title: "Error",
        description: "Failed to send invitation",
        variant: "destructive",
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleBulkInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkInviteLoading(true);
    setBulkInviteResults(null);

    try {
      const response = await fetch("/api/employees/invite/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvData,
          defaultRole: "EMPLOYEE",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Bulk Invite Complete",
          description: `${data.summary.successful} successful, ${data.summary.failed} failed, ${data.summary.skipped} skipped`,
        });
        setBulkInviteResults(data);
        if (data.summary.successful > 0) {
          fetchEmployees();
        }
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to process bulk invite",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to process bulk invite:", error);
      toast({
        title: "Error",
        description: "Failed to process bulk invite",
        variant: "destructive",
      });
    } finally {
      setBulkInviteLoading(false);
    }
  };

  const handleDeactivateEmployee = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to deactivate ${name}?`)) return;

    try {
      const response = await fetch(`/api/employees/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Employee deactivated successfully",
        });
        fetchEmployees();
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.error || "Failed to deactivate employee",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to deactivate employee:", error);
      toast({
        title: "Error",
        description: "Failed to deactivate employee",
        variant: "destructive",
      });
    }
  };

  const handleActivateEmployee = async (id: string, name: string) => {
    try {
      const response = await fetch(`/api/employees/${id}/activate`, {
        method: "POST",
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Employee activated successfully",
        });
        fetchEmployees();
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.error || "Failed to activate employee",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to activate employee:", error);
      toast({
        title: "Error",
        description: "Failed to activate employee",
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "ADMIN":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "DEPT_MANAGER":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default:
        return "bg-slate-500/10 text-slate-500 border-slate-500/20";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "INACTIVE":
        return "bg-slate-500/10 text-slate-500 border-slate-500/20";
      case "PENDING":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "SUSPENDED":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-slate-500/10 text-slate-500 border-slate-500/20";
    }
  };

  const canInvite =
    currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN";
  const canRemove =
    currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Team</h1>
            <p className="text-muted-foreground">
              Manage your team members and their permissions
            </p>
          </div>
          <div className="flex gap-2">
            {canInvite && (
              <>
                <Dialog
                  open={inviteDialogOpen}
                  onOpenChange={setInviteDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Invite Employee
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite Employee</DialogTitle>
                      <DialogDescription>
                        Send an invitation email to a new team member
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleInvite} className="space-y-4">
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="john@example.com"
                          value={inviteForm.email}
                          onChange={(e) =>
                            setInviteForm({
                              ...inviteForm,
                              email: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          placeholder="John Doe"
                          value={inviteForm.name}
                          onChange={(e) =>
                            setInviteForm({
                              ...inviteForm,
                              name: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="role">Role</Label>
                        <Select
                          value={inviteForm.role}
                          onValueChange={(value) =>
                            setInviteForm({ ...inviteForm, role: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EMPLOYEE">Employee</SelectItem>
                            <SelectItem value="DEPT_MANAGER">
                              Department Manager
                            </SelectItem>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="deptId">Department</Label>
                <Select
                          value={inviteForm.deptId || NO_DEPARTMENT}
                          onValueChange={(value) =>
                            setInviteForm({ ...inviteForm, deptId: value === NO_DEPARTMENT ? "" : value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_DEPARTMENT}>No department</SelectItem>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="employmentType">Employment Type</Label>
                        <Select
                          value={inviteForm.employmentType}
                          onValueChange={(value) =>
                            setInviteForm({
                              ...inviteForm,
                              employmentType: value,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FULL_TIME">Full Time</SelectItem>
                            <SelectItem value="PART_TIME">Part Time</SelectItem>
                            <SelectItem value="CONTRACT">Contract</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={inviteLoading}
                      >
                        {inviteLoading ? "Sending..." : "Send Invitation"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>

                <Dialog
                  open={bulkInviteDialogOpen}
                  onOpenChange={setBulkInviteDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Upload className="h-4 w-4 mr-2" />
                      Bulk Invite
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Bulk Invite Employees</DialogTitle>
                      <DialogDescription>
                        Upload CSV data to invite multiple employees at once
                      </DialogDescription>
                    </DialogHeader>
                    <Tabs defaultValue="csv" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="csv">CSV Data</TabsTrigger>
                        <TabsTrigger value="template">Template</TabsTrigger>
                      </TabsList>
                      <TabsContent value="csv" className="space-y-4">
                        <form onSubmit={handleBulkInvite}>
                          <div>
                            <Label htmlFor="csvData">CSV Data</Label>
                            <Textarea
                              id="csvData"
                              placeholder="email,name,role,dept_code,employment_type&#10;john@example.com,John Doe,EMPLOYEE,ENG,FULL_TIME&#10;jane@example.com,Jane Smith,EMPLOYEE,MKT,PART_TIME"
                              value={csvData}
                              onChange={(e) => setCsvData(e.target.value)}
                              rows={10}
                              required
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                              Required columns: email, name. Optional: role,
                              dept_code, employment_type
                            </p>
                          </div>
                          <Button
                            type="submit"
                            className="w-full mt-4"
                            disabled={bulkInviteLoading}
                          >
                            {bulkInviteLoading
                              ? "Processing..."
                              : "Process Bulk Invite"}
                          </Button>
                        </form>
                        {bulkInviteResults && (
                          <Alert>
                            <Check className="h-4 w-4" />
                            <AlertDescription>
                              <div className="space-y-2">
                                <div>
                                  <strong>Results:</strong>
                                </div>
                                <div>
                                  Total: {bulkInviteResults.summary.total}
                                </div>
                                <div className="text-green-600">
                                  Successful:{" "}
                                  {bulkInviteResults.summary.successful}
                                </div>
                                <div className="text-red-600">
                                  Failed: {bulkInviteResults.summary.failed}
                                </div>
                                <div className="text-yellow-600">
                                  Skipped: {bulkInviteResults.summary.skipped}
                                </div>
                              </div>
                            </AlertDescription>
                          </Alert>
                        )}
                      </TabsContent>
                      <TabsContent value="template" className="space-y-4">
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Use this template to prepare your CSV file. The
                            required columns are marked with an asterisk (*).
                          </AlertDescription>
                        </Alert>
                        <div className="bg-muted p-4 rounded-md">
                          <pre className="text-sm font-mono">
                            email*,name*,role,dept_code,employment_type
                            <br />
                            john@example.com,John Doe,EMPLOYEE,ENG,FULL_TIME
                            <br />
                            jane@example.com,Jane
                            Smith,DEPT_MANAGER,MKT,FULL_TIME
                          </pre>
                        </div>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            const template =
                              "email,name,role,dept_code,employment_type\njohn@example.com,John Doe,EMPLOYEE,ENG,FULL_TIME\njane@example.com,Jane Smith,DEPT_MANAGER,MKT,FULL_TIME";
                            const blob = new Blob([template], {
                              type: "text/csv",
                            });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = "employee_invite_template.csv";
                            a.click();
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Template
                        </Button>
                      </TabsContent>
                    </Tabs>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label>Department</Label>
                <Select value={filterDept || ALL_FILTER} onValueChange={setFilterDept}>
                  <SelectTrigger>
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER}>All departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Role</Label>
                <Select value={filterRole || ALL_FILTER} onValueChange={setFilterRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER}>All roles</SelectItem>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    <SelectItem value="DEPT_MANAGER">
                      Department Manager
                    </SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={filterStatus || ALL_FILTER} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employee Table */}
        <Card>
          <CardHeader>
            <CardTitle>Employees ({employees.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : employees.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <User className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No employees found</p>
                {canInvite && (
                  <Button
                    variant="link"
                    onClick={() => setInviteDialogOpen(true)}
                  >
                    Invite your first employee
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-[70px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage
                                src={employee.avatarUrl || undefined}
                              />
                              <AvatarFallback>
                                {getInitials(employee.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">
                                {employee.name || "Unknown"}
                              </div>
                              <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {employee.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {employee.employeeId || "N/A"}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getRoleBadgeColor(employee.role)}
                          >
                            {employee.role.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {employee.department?.name || "No Department"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getStatusBadgeColor(employee.status)}
                          >
                            {employee.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {employee.joinDate
                              ? new Date(employee.joinDate).toLocaleDateString()
                              : "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => router.push(`/team/${employee.id}`)}
                              >
                                <User className="h-4 w-4 mr-2" />
                                View Profile
                              </DropdownMenuItem>
                              {canRemove && (
                                <>
                                  {employee.status === "ACTIVE" ? (
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={() =>
                                        handleDeactivateEmployee(
                                          employee.id,
                                          employee.name || "Unknown",
                                        )
                                      }
                                    >
                                      <X className="h-4 w-4 mr-2" />
                                      Deactivate
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      className="text-green-600"
                                      onClick={() =>
                                        handleActivateEmployee(
                                          employee.id,
                                          employee.name || "Unknown",
                                        )
                                      }
                                    >
                                      <Check className="h-4 w-4 mr-2" />
                                      Activate
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
