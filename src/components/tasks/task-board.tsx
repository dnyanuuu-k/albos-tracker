'use client';

import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Task, TaskStatus } from '@/types/task';
import { GripVertical, Calendar, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

interface TaskBoardProps {
  tasks: Task[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onTaskClick: (task: Task) => void;
  onTaskUpdated: () => void;
}

const COLUMNS: { id: TaskStatus; title: string; color: string }[] = [
  { id: 'TO_DO', title: 'To Do', color: 'bg-slate-500' },
  { id: 'IN_PROGRESS', title: 'In Progress', color: 'bg-blue-500' },
  { id: 'IN_REVIEW', title: 'In Review', color: 'bg-purple-500' },
  { id: 'APPROVED', title: 'Approved', color: 'bg-green-500' },
  { id: 'REJECTED', title: 'Rejected', color: 'bg-red-500' },
  { id: 'COMPLETED', title: 'Completed', color: 'bg-emerald-500' },
  { id: 'ON_HOLD', title: 'On Hold', color: 'bg-amber-500' },
  { id: 'OVERDUE', title: 'Overdue', color: 'bg-red-600' },
  { id: 'CANCELLED', title: 'Cancelled', color: 'bg-gray-500' },
];

function DraggableTaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'HIGH':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'MEDIUM':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'LOW':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED' && task.status !== 'CANCELLED';

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className={`mb-2 cursor-pointer hover:shadow-md transition-shadow ${isDragging ? 'opacity-50' : ''}`}
        onClick={onClick}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <div className="cursor-grab active:cursor-grabbing mt-1">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm mb-2 line-clamp-2">{task.title}</h4>
              <div className="flex flex-wrap gap-1.5 mb-2">
                <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                  {task.priority}
                </Badge>
                {isOverdue && (
                  <Badge variant="destructive" className="text-xs gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Overdue
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {task.dueDate && (
                    <span className="flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      {format(new Date(task.dueDate), 'MMM d')}
                    </span>
                  )}
                  {task.estimatedHours && (
                    <span className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {task.actualHours || 0}/{task.estimatedHours}h
                    </span>
                  )}
                </div>
                <div className="flex -space-x-2">
                  {task.assignees.slice(0, 2).map((assignee) => (
                    <Avatar key={assignee.id} className="h-6 w-6 border-2 border-background">
                      <AvatarImage src={assignee.user.avatarUrl || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(assignee.user.name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {task.assignees.length > 2 && (
                    <Avatar className="h-6 w-6 border-2 border-background">
                      <AvatarFallback className="text-xs">
                        +{task.assignees.length - 2}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TaskBoard({ tasks, onStatusChange, onTaskClick, onTaskUpdated }: TaskBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const tasksByStatus = COLUMNS.reduce((acc, column) => {
    acc[column.id] = tasks.filter((task) => task.status === column.id);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  const activeTask = activeId ? tasks.find((task) => task.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    await onStatusChange(taskId, newStatus);
    onTaskUpdated();
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => (
          <div key={column.id} className="flex-shrink-0 w-80">
            <div className="mb-3 flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${column.color}`} />
              <h3 className="font-semibold">{column.title}</h3>
              <Badge variant="secondary" className="ml-auto">
                {tasksByStatus[column.id]?.length || 0}
              </Badge>
            </div>
            <div
              className="min-h-[200px] p-2 bg-muted/30 rounded-lg"
              data-droppable-id={column.id}
            >
              <SortableContext
                items={tasksByStatus[column.id].map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {tasksByStatus[column.id].map((task) => (
                  <DraggableTaskCard
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick(task)}
                  />
                ))}
              </SortableContext>
              {tasksByStatus[column.id].length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No tasks
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="rotate-3 opacity-90">
            <Card>
              <CardContent className="p-3">
                <h4 className="font-medium text-sm mb-2">{activeTask.title}</h4>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
