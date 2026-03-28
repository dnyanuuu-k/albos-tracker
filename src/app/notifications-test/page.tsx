'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function NotificationsTestPage() {
  const [userId, setUserId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const sendTestNotification = async () => {
    if (!userId || !title || !message) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          type: 'TASK_ASSIGNED',
          title,
          message,
          refEntity: 'Task',
          refId: 'test-task-id',
        }),
      });

      if (response.ok) {
        toast.success('Notification sent successfully!');
        setTitle('');
        setMessage('');
      } else {
        toast.error('Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Error sending notification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Notification Test</CardTitle>
          <CardDescription>
            Test the notification service by sending a test notification to a user
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="userId">User ID</Label>
            <Input
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter user ID (e.g., from /team page)"
            />
          </div>
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notification title"
            />
          </div>
          <div>
            <Label htmlFor="message">Message</Label>
            <Input
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Notification message"
            />
          </div>
          <Button onClick={sendTestNotification} disabled={loading}>
            {loading ? 'Sending...' : 'Send Notification'}
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>How to Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ol className="list-decimal list-inside space-y-2">
            <li>Make sure the notification service is running:</li>
            <code className="block bg-muted p-2 rounded ml-4">
              cd mini-services/notification-service && bun run dev
            </code>
            <li className="mt-4">Open the app in two browser tabs/windows:</li>
            <li className="ml-4">Tab 1: Go to /team and copy a user ID from a team member</li>
            <li className="ml-4">Tab 2: Go to this page (/notifications-test)</li>
            <li className="mt-4">Enter the user ID, title, and message</li>
            <li>Click "Send Notification"</li>
            <li>You should see the notification appear in the bell icon in Tab 1</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
