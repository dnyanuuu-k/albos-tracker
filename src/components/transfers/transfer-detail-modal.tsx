'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Check, X, Clock, Calendar, User, Building2, FileText } from 'lucide-react';
import { TransferStatus } from '@prisma/client';

interface Transfer {
  id: string;
  status: TransferStatus;
  effectiveDate: string;
  reason: string;
  createdAt: string;
  approvedAt?: string | null;
  approvedBy?: string | null;
  rejectedAt?: string | null;
  rejectedBy?: string | null;
  rejectedReason?: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    employeeId: string | null;
    avatarUrl: string | null;
    role: string;
    deptId: string | null;
    department?: {
      id: string;
      name: string;
      code: string;
    };
  };
  initiator: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
  fromDept: {
    id: string;
    name: string;
    code: string;
    manager?: {
      id: string;
      name: string | null;
      email: string;
    };
  };
  toDept: {
    id: string;
    name: string;
    code: string;
    managerId: string;
    manager?: {
      id: string;
      name: string | null;
      email: string;
    };
  };
  taskReassignmentsData?: any;
}

interface Props {
  transfer: Transfer;
  onClose: () => void;
  onUpdate: () => void;
}

const statusColors: Record<TransferStatus, string> = {
  PENDING: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  APPROVED: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  REJECTED: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
  CANCELLED: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20',
};

export default function TransferDetailModal({ transfer, onClose, onUpdate }: Props) {
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
  const [approveNote, setApproveNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/transfers/${transfer.id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: approveNote }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve transfer');
      }

      toast.success('Transfer approved successfully');
      onUpdate();
      onClose();
    } catch (error: any) {
      console.error('Error approving transfer:', error);
      toast.error(error.message || 'Failed to approve transfer');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/transfers/${transfer.id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reject transfer');
      }

      toast.success('Transfer rejected successfully');
      onUpdate();
      onClose();
    } catch (error: any) {
      console.error('Error rejecting transfer:', error);
      toast.error(error.message || 'Failed to reject transfer');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/transfers/${transfer.id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel transfer');
      }

      toast.success('Transfer cancelled successfully');
      onUpdate();
      onClose();
    } catch (error: any) {
      console.error('Error cancelling transfer:', error);
      toast.error(error.message || 'Failed to cancel transfer');
    } finally {
      setLoading(false);
    }
  };

  const canApprove = currentUser?.id === transfer.toDept.managerId && transfer.status === 'PENDING';
  const canReject = currentUser?.id === transfer.toDept.managerId && transfer.status === 'PENDING';
  const canCancel =
    (currentUser?.id === transfer.initiator.id ||
      currentUser?.id === transfer.user.id ||
      currentUser?.role === 'ADMIN' ||
      currentUser?.role === 'SUPER_ADMIN') &&
    transfer.status === 'PENDING';

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Transfer Request Details</DialogTitle>
        <DialogDescription>
          {transfer.status === 'PENDING' ? 'Review and take action on this transfer request' : 'Transfer request details'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <Badge className={statusColors[transfer.status]} variant="outline" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
            {transfer.status}
          </Badge>
          <div className="text-sm text-muted-foreground">
            Created on {formatDate(transfer.createdAt)}
          </div>
        </div>

        {/* Employee Information */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <User className="h-5 w-5" />
            Employee Information
          </h3>
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={transfer.user.avatarUrl || undefined} />
              <AvatarFallback className="text-xl">{getInitials(transfer.user.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <div className="font-semibold text-lg">{transfer.user.name || 'Unknown'}</div>
                <Badge variant="outline">{transfer.user.role.replace('_', ' ')}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {transfer.user.employeeId && <span>{transfer.user.employeeId} · </span>}
                {transfer.user.email}
              </div>
              {transfer.user.designation && (
                <div className="text-sm">{transfer.user.designation}</div>
              )}
              {transfer.user.department && (
                <div className="text-sm text-muted-foreground">
                  Currently in {transfer.user.department.name}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transfer Details */}
        <div className="grid grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-red-600">
              <Building2 className="h-5 w-5" />
              From Department
            </h3>
            <div className="space-y-2">
              <div className="font-medium text-lg">{transfer.fromDept.name}</div>
              <div className="text-sm text-muted-foreground">{transfer.fromDept.code}</div>
              {transfer.fromDept.manager && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Manager: </span>
                  {transfer.fromDept.manager.name || transfer.fromDept.manager.email}
                </div>
              )}
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-green-600">
              <Building2 className="h-5 w-5" />
              To Department
            </h3>
            <div className="space-y-2">
              <div className="font-medium text-lg">{transfer.toDept.name}</div>
              <div className="text-sm text-muted-foreground">{transfer.toDept.code}</div>
              {transfer.toDept.manager && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Manager: </span>
                  {transfer.toDept.manager.name || transfer.toDept.manager.email}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Effective Date and Reason */}
        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Effective Date
            </h3>
            <div className="text-lg font-medium">{formatDate(transfer.effectiveDate)}</div>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Reason for Transfer
            </h3>
            <p className="text-sm leading-relaxed">{transfer.reason}</p>
          </div>
        </div>

        {/* Task Reassignments */}
        {transfer.taskReassignmentsData && Object.keys(transfer.taskReassignmentsData).length > 0 && (
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Task Reassignments
            </h3>
            <div className="space-y-2">
              {Object.entries(transfer.taskReassignmentsData).map(([taskId, data]: [string, any]) => (
                <div key={taskId} className="bg-muted rounded p-3">
                  <div className="font-medium">{data.task.title}</div>
                  <div className="text-sm text-muted-foreground">
                    Reassigning to: {data.newAssigneeId || 'No reassignment'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approval/Rejection Details */}
        {transfer.status === 'APPROVED' && (
          <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950/20">
            <h3 className="font-semibold mb-2 flex items-center gap-2 text-green-700 dark:text-green-400">
              <Check className="h-5 w-5" />
              Transfer Approved
            </h3>
            <div className="text-sm text-green-700 dark:text-green-400">
              Approved on {formatDate(transfer.approvedAt!)}
              {transfer.approvedBy && ` by ${transfer.approvedBy}`}
            </div>
          </div>
        )}

        {transfer.status === 'REJECTED' && (
          <div className="border rounded-lg p-4 bg-red-50 dark:bg-red-950/20">
            <h3 className="font-semibold mb-2 flex items-center gap-2 text-red-700 dark:text-red-400">
              <X className="h-5 w-5" />
              Transfer Rejected
            </h3>
            <div className="text-sm text-red-700 dark:text-red-400 space-y-1">
              <div>Rejected on {formatDate(transfer.rejectedAt!)}</div>
              {transfer.rejectedReason && <div>Reason: {transfer.rejectedReason}</div>}
            </div>
          </div>
        )}

        {/* Initiated By */}
        <div className="text-sm text-muted-foreground border-t pt-4">
          <span className="font-medium">Initiated by:</span>{' '}
          {transfer.initiator.name || transfer.initiator.email}
        </div>
      </div>

      {/* Actions */}
      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>

        {transfer.status === 'PENDING' && (
          <>
            {canCancel && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={loading}>
                    Cancel Transfer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Transfer Request</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to cancel this transfer request? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="py-4">
                    <Label htmlFor="cancel-reason">Reason (optional)</Label>
                    <Textarea
                      id="cancel-reason"
                      placeholder="Provide a reason for cancellation..."
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Back</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancel} disabled={loading}>
                      {loading ? 'Cancelling...' : 'Cancel Transfer'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {canApprove && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="border-green-500 text-green-700 hover:bg-green-50" disabled={loading}>
                    <Check className="mr-2 h-4 w-4" />
                    Approve Transfer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Approve Transfer Request</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to approve this transfer? The employee will be moved to your department
                      and any task reassignments will be processed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="py-4">
                    <Label htmlFor="approve-note">Note (optional)</Label>
                    <Textarea
                      id="approve-note"
                      placeholder="Add a note for the employee and initiators..."
                      value={approveNote}
                      onChange={(e) => setApproveNote(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Back</AlertDialogCancel>
                    <AlertDialogAction onClick={handleApprove} disabled={loading}>
                      {loading ? 'Approving...' : 'Approve Transfer'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {canReject && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={loading}>
                    <X className="mr-2 h-4 w-4" />
                    Reject Transfer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reject Transfer Request</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to reject this transfer request? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="py-4">
                    <Label htmlFor="reject-reason">Rejection Reason *</Label>
                    <Textarea
                      id="reject-reason"
                      placeholder="Provide a reason for rejecting this transfer..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Back</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReject} disabled={loading}>
                      {loading ? 'Rejecting...' : 'Reject Transfer'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
