'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { X, Plus, AlertTriangle } from 'lucide-react';

interface AddUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  onSuccess?: () => void;
  existingUpdate?: {
    id: string;
    progress: number;
    hours: number;
    note: string | null;
    blockers: string[];
  };
}

export default function AddUpdateDialog({
  open,
  onOpenChange,
  taskId,
  onSuccess,
  existingUpdate,
}: AddUpdateDialogProps) {
  const [progress, setProgress] = useState(existingUpdate?.progress || 0);
  const [hours, setHours] = useState(existingUpdate?.hours || 0);
  const [note, setNote] = useState(existingUpdate?.note || '');
  const [blockerInput, setBlockerInput] = useState('');
  const [blockers, setBlockers] = useState<string[]>(existingUpdate?.blockers || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = !!existingUpdate;

  useEffect(() => {
    if (existingUpdate) {
      setProgress(existingUpdate.progress);
      setHours(existingUpdate.hours);
      setNote(existingUpdate.note || '');
      setBlockers(existingUpdate.blockers);
    } else {
      // Reset form when opening for new update
      setProgress(0);
      setHours(0);
      setNote('');
      setBlockers([]);
    }
    setError(null);
  }, [open, existingUpdate]);

  const handleAddBlocker = () => {
    if (blockerInput.trim() && blockers.length < 10) {
      setBlockers([...blockers, blockerInput.trim()]);
      setBlockerInput('');
    }
  };

  const handleRemoveBlocker = (index: number) => {
    setBlockers(blockers.filter((_, i) => i !== index));
  };

  const handleBlockerInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddBlocker();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url = isEditing
        ? `/api/tasks/${taskId}/updates/${existingUpdate.id}`
        : `/api/tasks/${taskId}/updates`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          progress,
          hours,
          note: note || null,
          blockers: blockers.length > 0 ? blockers : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save update');
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Failed to save update');
    } finally {
      setLoading(false);
    }
  };

  const getProgressColor = (value: number) => {
    if (value >= 100) return 'text-green-500';
    if (value >= 75) return 'text-blue-500';
    if (value >= 50) return 'text-yellow-500';
    if (value >= 25) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Progress Update' : 'Add Progress Update'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update your progress on this task'
              : 'Log your daily progress and any blockers for this task'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Progress Slider */}
          <div className="space-y-2">
            <Label htmlFor="progress">
              Progress <span className={getProgressColor(progress)}>({progress}%)</span>
            </Label>
            <Slider
              id="progress"
              value={[progress]}
              onValueChange={(value) => setProgress(value[0])}
              max={100}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Hours Input */}
          <div className="space-y-2">
            <Label htmlFor="hours">Hours Worked</Label>
            <Input
              id="hours"
              type="number"
              min="0"
              max="9999"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(parseFloat(e.target.value) || 0)}
              placeholder="Enter hours worked"
            />
          </div>

          {/* Note/Comments */}
          <div className="space-y-2">
            <Label htmlFor="note">Status Notes (Optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did you work on? Any achievements or challenges?"
              rows={3}
              maxLength={2000}
            />
            <div className="text-xs text-muted-foreground text-right">
              {note.length} / 2000
            </div>
          </div>

          {/* Blockers */}
          <div className="space-y-2">
            <Label htmlFor="blockers">
              Blockers <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="blockers"
                value={blockerInput}
                onChange={(e) => setBlockerInput(e.target.value)}
                onKeyDown={handleBlockerInputKeyDown}
                placeholder="Add a blocker (e.g., Waiting for API key)"
                disabled={blockers.length >= 10}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddBlocker}
                disabled={!blockerInput.trim() || blockers.length >= 10}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Blockers List */}
            {blockers.length > 0 && (
              <div className="space-y-2 mt-2">
                {blockers.map((blocker, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 bg-orange-50 dark:bg-orange-950/20 px-3 py-2 rounded"
                  >
                    <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm flex-1">{blocker}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveBlocker(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {blockers.length} / 10 blockers added
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              {error}
            </div>
          )}

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
              {loading ? 'Saving...' : isEditing ? 'Update' : 'Add Update'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
