'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Clock, AlertTriangle, User } from 'lucide-react';
import { format } from 'date-fns';

interface TaskUpdate {
  id: string;
  progress: number;
  hours: number;
  note: string | null;
  blockers: string[];
  createdAt: Date;
  user?: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

interface TaskUpdateTimelineProps {
  updates: TaskUpdate[];
  currentUserId?: string;
  onUpdate?: (updateId: string) => void;
  onDelete?: (updateId: string) => void;
  showActions?: boolean;
}

export function TaskUpdateTimeline({
  updates,
  currentUserId,
  onUpdate,
  onDelete,
  showActions = false,
}: TaskUpdateTimelineProps) {
  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 75) return 'bg-blue-500';
    if (progress >= 50) return 'bg-yellow-500';
    if (progress >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (updates.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No updates yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Be the first to add a progress update
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {updates.map((update, index) => {
        const isLatest = index === 0;
        const author = update.user ?? {
          id: '',
          name: null as string | null,
          email: '',
          avatarUrl: null as string | null,
        };
        const isOwn = author.id === currentUserId;

        return (
          <div key={update.id} className="relative">
            {/* Timeline line */}
            {index < updates.length - 1 && (
              <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-border" />
            )}

            <Card className={isLatest ? 'border-primary' : ''}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <Avatar className="h-10 w-10 border-2 border-background">
                      <AvatarImage src={author.avatarUrl || undefined} />
                      <AvatarFallback className="text-sm">
                        {getInitials(author.name)}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">
                            {author.name || 'Unknown'}
                          </span>
                          {isLatest && (
                            <Badge variant="default" className="text-xs">
                              Latest
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>
                            {format(new Date(update.createdAt), 'MMM d, yyyy • h:mm a')}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      {showActions && isOwn && (
                        <div className="flex gap-1">
                          {onUpdate && (
                            <button
                              onClick={() => onUpdate(update.id)}
                              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted"
                            >
                              Edit
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(update.id)}
                              className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded hover:bg-destructive/10"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-semibold">{update.progress}%</span>
                      </div>
                      <Progress
                        value={update.progress}
                        className="h-2"
                      />
                    </div>

                    {/* Hours */}
                    <div className="flex items-center gap-2 text-sm mb-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Hours worked:</span>
                      <span className="font-semibold">{update.hours}h</span>
                    </div>

                    {/* Note */}
                    {update.note && (
                      <div className="mb-3">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {update.note}
                        </p>
                      </div>
                    )}

                    {/* Blockers */}
                    {update.blockers && update.blockers.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          <span className="text-sm font-semibold text-orange-600">
                            Blockers ({update.blockers.length})
                          </span>
                        </div>
                        <div className="space-y-1">
                          {update.blockers.map((blocker, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-2 text-sm bg-orange-50 dark:bg-orange-950/20 px-3 py-2 rounded"
                            >
                              <span className="text-orange-500 mt-0.5">•</span>
                              <span className="text-orange-800 dark:text-orange-200">
                                {blocker}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
