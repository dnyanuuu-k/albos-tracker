'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, Plus, Eye, Calendar, User, Building2, Clock, Check, X } from 'lucide-react';
import { TransferStatus } from '@prisma/client';
import InitiateTransferDialog from '@/components/transfers/initiate-transfer-dialog';
import TransferDetailModal from '@/components/transfers/transfer-detail-modal';

interface Transfer {
  id: string;
  status: TransferStatus;
  effectiveDate: string;
  reason: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    employeeId: string | null;
    avatarUrl: string | null;
  };
  initiator: {
    id: string;
    name: string | null;
    email: string;
  };
  fromDept: {
    id: string;
    name: string;
    code: string;
  };
  toDept: {
    id: string;
    name: string;
    code: string;
  };
}

interface PaginatedResponse<T> {
  data?: T[];
  transfers?: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const statusColors: Record<TransferStatus, string> = {
  PENDING: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  APPROVED: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  REJECTED: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
  CANCELLED: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20',
};

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Dialog states
  const [initiateDialogOpen, setInitiateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/transfers?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch transfers');

      const data: PaginatedResponse<Transfer> = await response.json();
      setTransfers(data.transfers || data.data || []);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (error) {
      console.error('Error fetching transfers:', error);
      toast.error('Failed to load transfers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, [page, searchTerm, statusFilter]);

  const handleTransferInitiated = () => {
    setInitiateDialogOpen(false);
    fetchTransfers();
    toast.success('Transfer request initiated successfully');
  };

  const handleViewTransfer = (transfer: Transfer) => {
    setSelectedTransfer(transfer);
    setDetailDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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

  return (
    <DashboardLayout>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Department Transfers</h1>
          <p className="text-muted-foreground mt-1">
            Manage employee department transfer requests
          </p>
        </div>
        <Dialog open={initiateDialogOpen} onOpenChange={setInitiateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Initiate Transfer
            </Button>
          </DialogTrigger>
          <InitiateTransferDialog
            onSuccess={handleTransferInitiated}
            onCancel={() => setInitiateDialogOpen(false)}
          />
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or employee ID..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transfers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer Requests</CardTitle>
          <CardDescription>
            {total} total transfer request{total !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">Loading transfers...</div>
            </div>
          ) : transfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No transfers found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Get started by initiating a new transfer request'}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Button onClick={() => setInitiateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Initiate Transfer
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>From Department</TableHead>
                      <TableHead>To Department</TableHead>
                      <TableHead>Effective Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Initiated By</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map((transfer) => (
                      <TableRow key={transfer.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={transfer.user.avatarUrl || undefined} />
                              <AvatarFallback>{getInitials(transfer.user.name)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{transfer.user.name || 'Unknown'}</div>
                              <div className="text-sm text-muted-foreground">
                                {transfer.user.employeeId || transfer.user.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{transfer.fromDept.name}</div>
                            <div className="text-sm text-muted-foreground">{transfer.fromDept.code}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{transfer.toDept.name}</div>
                            <div className="text-sm text-muted-foreground">{transfer.toDept.code}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDate(transfer.effectiveDate)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[transfer.status]} variant="outline">
                            {transfer.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {transfer.initiator.name || transfer.initiator.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {transfer.status === 'PENDING' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={async () => {
                                    try {
                                      const response = await fetch(`/api/transfers/${transfer.id}/approve`, {
                                        method: 'POST',
                                      });
                                      if (response.ok) {
                                        toast.success('Transfer approved successfully');
                                        fetchTransfers();
                                      } else {
                                        const data = await response.json();
                                        toast.error(data.error || 'Failed to approve transfer');
                                      }
                                    } catch (err) {
                                      toast.error('Failed to approve transfer');
                                    }
                                  }}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={async () => {
                                    const reason = prompt('Enter rejection reason (optional):');
                                    if (reason !== null) {
                                      try {
                                        const response = await fetch(`/api/transfers/${transfer.id}/reject`, {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ reason: reason || '' }),
                                        });
                                        if (response.ok) {
                                          toast.success('Transfer rejected successfully');
                                          fetchTransfers();
                                        } else {
                                          const data = await response.json();
                                          toast.error(data.error || 'Failed to reject transfer');
                                        }
                                      } catch (err) {
                                        toast.error('Failed to reject transfer');
                                      }
                                    }
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} transfers
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Transfer Detail Modal */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        {selectedTransfer && (
          <TransferDetailModal
            transfer={selectedTransfer}
            onClose={() => {
              setDetailDialogOpen(false);
              setSelectedTransfer(null);
            }}
            onUpdate={fetchTransfers}
          />
        )}
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
