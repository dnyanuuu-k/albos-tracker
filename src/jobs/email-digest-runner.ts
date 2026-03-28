import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { serverConfig } from '@/lib/server-config';
import { UserRole, type User } from '@prisma/client';

type JsonObject = Record<string, any>;

function parseJson(s: string | null | undefined): JsonObject {
  try {
    if (!s) return {};
    return JSON.parse(s) as JsonObject;
  } catch {
    return {};
  }
}

function toRunDateStringUtc(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function getUtcDayRange(d: Date): { start: Date; end: Date } {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();

  const start = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
  return { start, end };
}

function hasEmailDigestEnabled(settings: JsonObject): boolean {
  // Default is enabled; settings toggle stores `emailDigest: boolean`.
  return settings.emailDigest !== false;
}

async function updateUserSettings(
  userId: string,
  updater: (prev: JsonObject) => JsonObject
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });
  if (!user) return;

  const prev = parseJson(user.settings);
  const next = updater(prev);
  await db.user.update({
    where: { id: userId },
    data: { settings: JSON.stringify(next) },
  });
}

async function maybeSendManagerDigest(params: {
  orgId: string;
  manager: User & { settings: string | null };
  runDate: string;
  start: Date;
  end: Date;
}) {
  const { orgId, manager, runDate, start, end } = params;
  const settings = parseJson(manager.settings);

  if (!hasEmailDigestEnabled(settings)) return;

  const alreadySent = settings.lastEmailDigestRunDate === runDate;
  if (alreadySent) return;

  const taskWhere: any = { orgId };
  if (manager.role === UserRole.DEPT_MANAGER) {
    if (!manager.deptId) return;
    taskWhere.deptId = manager.deptId;
  }

  const updates = await db.taskUpdate.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      task: taskWhere,
    },
    select: {
      userId: true,
      progress: true,
      hours: true,
      blockers: true,
      task: {
        select: {
          department: { select: { id: true, name: true } },
        },
      },
    },
  });

  const totalUpdates = updates.length;
  const totalHours = updates.reduce((sum, u) => sum + Number(u.hours ?? 0), 0);
  const averageProgress =
    totalUpdates > 0
      ? Math.round(
          updates.reduce((sum, u) => sum + Number(u.progress ?? 0), 0) / totalUpdates
        )
      : 0;

  const submittedUserIds = new Set(updates.map((u) => u.userId));

  const scopeUsers = await db.user.findMany({
    where: {
      orgId,
      status: 'ACTIVE',
      ...(manager.role === UserRole.DEPT_MANAGER && manager.deptId
        ? { deptId: manager.deptId }
        : {}),
    },
    select: {
      id: true,
      role: true,
      settings: true,
    },
  });

  const missedEmployees = scopeUsers.filter(
    (u) => u.role === UserRole.EMPLOYEE && !submittedUserIds.has(u.id)
  );

  const resendConfigured = Boolean(serverConfig.resendApiKey);
  const subject = `ETMS Daily Digest (${runDate})`;

  const html = `
    <h2>Daily Task Digest</h2>
    <p><strong>Date:</strong> ${runDate}</p>
    <ul>
      <li><strong>Total updates:</strong> ${totalUpdates}</li>
      <li><strong>Total hours:</strong> ${totalHours.toFixed(2)}</li>
      <li><strong>Average progress:</strong> ${averageProgress}%</li>
      <li><strong>Employees missed updates:</strong> ${missedEmployees.length}</li>
    </ul>
    <p style="color:#666;">
      This is an automated email${resendConfigured ? '' : ' (email delivery is mocked in this environment)'}.
    </p>
    <p>
      Open ETMS to review details:
      <a href="${serverConfig.appUrl}/dashboard" target="_blank" rel="noreferrer">Dashboard</a>
    </p>
  `;

  const text = `ETMS Daily Digest (${runDate})
Total updates: ${totalUpdates}
Total hours: ${totalHours.toFixed(2)}
Average progress: ${averageProgress}%
Employees missed updates: ${missedEmployees.length}

Dashboard: ${serverConfig.appUrl}/dashboard`;

  await sendEmail({ to: manager.email, subject, html, text });

  // Mark as sent only after successful email delivery.
  await updateUserSettings(manager.id, (prev) => ({
    ...prev,
    lastEmailDigestRunDate: runDate,
  }));
}

async function maybeSendMissedUpdateReminders(params: {
  employees: Array<User & { settings: string | null }>;
  runDate: string;
}) {
  const { employees, runDate } = params;

  for (const employee of employees) {
    const settings = parseJson(employee.settings);
    if (!hasEmailDigestEnabled(settings)) continue;

    if (settings.lastMissedUpdateReminderRunDate === runDate) continue;

    const subject = `ETMS Reminder: Daily Update Needed (${runDate})`;
    const html = `
      <h2>Daily Update Reminder</h2>
      <p>Hi${employee.name ? ` ${employee.name}` : ''},</p>
      <p>Our records show you didn’t submit your daily task update for <strong>${runDate}</strong>.</p>
      <p>Please log in and add your updates today.</p>
      <p>
        <a href="${serverConfig.appUrl}/dashboard" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;" target="_blank" rel="noreferrer">
          Open ETMS Dashboard
        </a>
      </p>
      <p style="color:#666;margin-top:16px;">
        This is an automated reminder.
      </p>
    `;

    const text = `Hi${employee.name ? ` ${employee.name}` : ''},

You didn’t submit your daily task update for ${runDate}.

Dashboard: ${serverConfig.appUrl}/dashboard

This is an automated reminder.`;

    await sendEmail({ to: employee.email, subject, html, text });

    await updateUserSettings(employee.id, (prev) => ({
      ...prev,
      lastMissedUpdateReminderRunDate: runDate,
    }));
  }
}

export async function runEmailDigestJob(targetDate: Date): Promise<void> {
  const runDate = toRunDateStringUtc(targetDate);
  const { start, end } = getUtcDayRange(targetDate);

  const orgs = await db.organization.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const org of orgs) {
    const managers = await db.user.findMany({
      where: {
        orgId: org.id,
        status: 'ACTIVE',
        role: { in: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DEPT_MANAGER] },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        deptId: true,
        settings: true,
      },
    });

    for (const manager of managers) {
      await maybeSendManagerDigest({
        orgId: org.id,
        manager: manager as any,
        runDate,
        start,
        end,
      });
    }

    // Compute missed employees per org once (scope varies by manager dept, but employees should be reminded if any manager scope includes them).
    // For simplicity and “no future management”, we remind across the whole org based on whether they submitted *any* update in this org on the date.
    const updates = await db.taskUpdate.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        task: { orgId: org.id },
      },
      select: { userId: true },
    });
    const submittedUserIds = new Set(updates.map((u) => u.userId));

    const activeEmployees = await db.user.findMany({
      where: {
        orgId: org.id,
        status: 'ACTIVE',
        role: UserRole.EMPLOYEE,
      },
      select: {
        id: true,
        email: true,
        name: true,
        settings: true,
        role: true,
      },
    });

    const missedEmployees = activeEmployees.filter(
      (u) => !submittedUserIds.has(u.id)
    );

    await maybeSendMissedUpdateReminders({
      employees: missedEmployees as any,
      runDate,
    });
  }
}

