# ETMS — Full Requirements Audit & Production Implementation Plan

## Background

The ETMS SRS v1.0 defines a full-stack enterprise task management SaaS. The codebase was AI-generated and has 52 API routes, 13 pages, and a Prisma/SQLite schema. This plan cross-verifies every requirement against the current implementation and defines what must be built to reach production quality.

---

## 📊 Gap Analysis: SRS Requirements vs Current State

### ✅ IMPLEMENTED (Working or Partially Working)

| Feature | Status | Notes |
|---------|--------|-------|
| Login with bcrypt + JWT | ✅ Working | 12 rounds, 8h access / 30d refresh tokens |
| Role-based access (4 roles) | ✅ Working | RBAC middleware in place |
| Employee listing + filters | ✅ Fixed | Was broken (SQLite mode:insensitive bug) |
| Department CRUD | ✅ Working | Archive supported |
| Task CRUD + status flow | ✅ Working | Full 8-status workflow |
| Task assignments (multi-user) | ✅ Working | TaskAssignee join table |
| Daily task updates | ✅ Working | Progress %, hours, notes |
| Task comments | ✅ Working | Threaded, with userId |
| Transfer workflow | ✅ Fixed | Was broken (invalid Prisma relations) |
| Transfer approve/reject | ✅ Working | `/api/transfers/[id]/approve` etc. |
| In-app notifications | ✅ Working | Bell icon, unread count |
| Analytics dashboard | ✅ Working | By status, priority, top performers |
| Audit logs | ✅ Working | Immutable, searchable |
| Audit log export | ✅ Working | `/api/audit-logs/export` |
| Invite single employee | ✅ Working | Token-based, 72h expiry |
| Bulk CSV invite | ✅ Working | CSV parsing, dept lookup |
| Employee profile | ✅ Working | All required fields |
| Soft delete (deactivate) | ✅ Working | Status→INACTIVE |

---

### ❌ MISSING / BROKEN — Must Implement

#### 🔴 CRITICAL (Blocks Production)

| # | Requirement | Location | Issue |
|---|-------------|----------|-------|
| 1 | **Accept Invitation flow** — `/auth/accept-invite` page | No UI page | API exists (`/api/auth/register`) but no frontend page for employees to accept invite + set password |
| 2 | **Forgot Password** — 15-min reset link | No API, no UI | Neither the API route nor UI page exists |
| 3 | **Dashboard /dashboard/employees** page | Page exists but broken | Fetches `/api/employees` expecting `data.employees` — now fixed, but page itself has routing issues |
| 4 | **`/transfers` page** wraps in DashboardLayout | Works | But navigates via sidebar to `/transfers` not `/dashboard/transfers` — inconsistent routing |
| 5 | **Task detail page** | Missing | No `/dashboard/tasks/[id]` page for viewing a single task with comments/updates |
| 6 | **Kanban board** for Department Manager | Missing | Required by SRS §4.6.2 — drag-and-drop Kanban |
| 7 | **Department details page** | Missing | `/dashboard/departments/[id]` — headcount, tasks, performance |
| 8 | **Department transfer approval UI** | Missing | Target manager needs a UI to accept/decline transfers |
| 9 | **My Updates page** (`/my-updates`) | Exists but needs work | Shows updates but linked from wrong sidebar href |
| 10 | **Settings page** | Exists but incomplete | No org settings, notification preferences, or profile edit |
| 11 | **Notification preferences** | Missing | Email digest config, unsubscribe options |
| 12 | **CSV/XLSX/PDF export** for reports | API route exists but UI missing | No export buttons on analytics/reports pages |

#### 🟡 IMPORTANT (Required by SRS, not implemented)

| # | Requirement | Status |
|---|-------------|--------|
| 13 | Subtasks (parent/child tasks) | Schema supports `parentTaskId` but no UI |
| 14 | Recurring tasks | Schema has `recurrenceType` but no auto-generation logic |
| 15 | Task file attachments (up to 10MB) | Not implemented (needs S3/file storage) |
| 16 | Task templates | Not implemented |
| 17 | @mention in comments (notify user) | Comment API exists but @mention parsing missing |
| 18 | Real-time notifications (Socket.IO/SSE) | Polling only — needs live updates |
| 19 | Department dashboard (headcount, scores) | API exists (`/api/dashboard/stats`) but no page |
| 20 | Monthly PDF reports (auto-generated) | Not implemented |
| 21 | Employee onboarding checklist | Not implemented (welcome notification only) |
| 22 | Transfer wizard — task reassignment UI | Transfer form exists, reassignment picker missing |
| 23 | Dark mode toggle | `next-themes` installed but no toggle in UI |
| 24 | Overdue task auto-escalation | No scheduled job / cron |
| 25 | Rate limiting (100 req/min) | Not implemented |
| 26 | NEXTAUTH_SECRET / `next-auth` config | Package installed but unused; may conflict |
| 27 | Employee profile photo upload | No file upload endpoint |

---

> [!IMPORTANT]
> **Phase 1 (fixes 1–12): These are the minimum features to make the app usable and production-worthy for a demo/beta launch.** Fixes 13–27 are Phase 2 (full SRS compliance).

---

## Proposed Changes — Phase 1 (Production-Ready Beta)

### 1. Auth — Accept Invitation Page
#### [NEW] `src/app/accept-invite/page.tsx`
- Token-based form: set password + name
- Calls `/api/auth/register` with `token` in URL
- Redirects to dashboard on success

#### [MODIFY] [src/app/api/auth/register/route.ts](file:///c:/Users/kdnya/Downloads/workspace-87b6f850-0cdf-448e-9bc2-fc037ad11e8b/src/app/api/auth/register/route.ts)
- Validate invitation token from DB before creating user
- Mark invitation as `usedAt = now()` on success

---

### 2. Auth — Forgot Password Flow
#### [NEW] `src/app/api/auth/forgot-password/route.ts`
- Accept email → generate reset token → log to console (email service placeholder)
- Store hashed token in User record with 15-min expiry

#### [NEW] `src/app/api/auth/reset-password/route.ts`
- Validate token, enforce password rules, update `passwordHash`, invalidate token

#### [NEW] `src/app/forgot-password/page.tsx` + `src/app/reset-password/page.tsx`
- Clean form UIs matching existing login style

---

### 3. Task Detail Page
#### [NEW] `src/app/dashboard/tasks/[id]/page.tsx`
- Full task view: description, priority, status, assignees
- Tabbed sections: Updates (daily log), Comments (threaded), Subtasks
- Update status button (role-gated)
- Log daily update form

---

### 4. Department Details Page
#### [NEW] `src/app/dashboard/departments/[id]/page.tsx`
- Headcount breakdown, active tasks by status
- Employee list for the department
- Performance score (completion rate)
- Pending transfer requests for the department

---

### 5. Settings Page — Complete Implementation
#### [MODIFY] [src/app/dashboard/settings/page.tsx](file:///c:/Users/kdnya/Downloads/workspace-87b6f850-0cdf-448e-9bc2-fc037ad11e8b/src/app/dashboard/settings/page.tsx)
- Profile section: edit name, phone, upload avatar (base64 for now)
- Organization section (Admin+): org name, slug, timezone
- Notification preferences: toggle email digests

---

### 6. Export Buttons on Analytics Page
#### [MODIFY] [src/app/dashboard/analytics/page.tsx](file:///c:/Users/kdnya/Downloads/workspace-87b6f850-0cdf-448e-9bc2-fc037ad11e8b/src/app/dashboard/analytics/page.tsx)
- Add "Export CSV" and "Export PDF" buttons
- Call existing `/api/audit-logs/export` and analytics endpoints
- Client-side PDF generation with `jspdf` (already installed)

---

### 7. Transfer Approval UI
#### [MODIFY] [src/app/transfers/page.tsx](file:///c:/Users/kdnya/Downloads/workspace-87b6f850-0cdf-448e-9bc2-fc037ad11e8b/src/app/transfers/page.tsx)
- Add "Approve" / "Reject" action buttons on pending transfers (role-gated to ADMIN/SUPER_ADMIN/DEPT_MANAGER)
- Call `/api/transfers/[id]/approve` and `/api/transfers/[id]/reject`

---

### 8. Sidebar Routing Fix + Navigation Polish
#### [MODIFY] [src/components/dashboard/dashboard-layout.tsx](file:///c:/Users/kdnya/Downloads/workspace-87b6f850-0cdf-448e-9bc2-fc037ad11e8b/src/components/dashboard/dashboard-layout.tsx)
- Fix sidebar hrefs to match actual routes
- Add `/my-updates` and `/transfers` correctly in nav

---

### 9. Dark Mode Toggle
#### [MODIFY] [src/components/dashboard/dashboard-layout.tsx](file:///c:/Users/kdnya/Downloads/workspace-87b6f850-0cdf-448e-9bc2-fc037ad11e8b/src/components/dashboard/dashboard-layout.tsx)
- Add moon/sun icon toggle using `next-themes`
- Persist preference via ThemeProvider already in [layout.tsx](file:///c:/Users/kdnya/Downloads/workspace-87b6f850-0cdf-448e-9bc2-fc037ad11e8b/src/app/layout.tsx)

---

### 10. Rate Limiting (Security Critical)
#### [NEW] `src/lib/rate-limit.ts`
- In-memory sliding window rate limiter (no Redis needed for SQLite/dev)
- Apply to `/api/auth/login` and `/api/auth/forgot-password`

---

## Verification Plan

### Automated — API Endpoint Testing
Run these via PowerShell after each phase:
```powershell
# Login
$r = Invoke-WebRequest http://localhost:3000/api/auth/login -Method POST -ContentType "application/json" -Body '{"email":"admin@example.com","password":"ChangeMe!123"}' -UseBasicParsing
# Expect: 200

# Forgot password
$r = Invoke-WebRequest http://localhost:3000/api/auth/forgot-password -Method POST -ContentType "application/json" -Body '{"email":"admin@example.com"}' -UseBasicParsing
# Expect: 200
```

### Browser Testing (Manual)
Each page tested via the Antigravity browser tool:
1. Login → dashboard loads ✅
2. Navigate to `/dashboard/tasks` → task list loads ✅
3. Click a task → task detail page opens
4. Navigate to `/dashboard/departments` → list loads
5. Click a department → department detail page opens
6. Navigate to `/transfers` → transfers load, approve/reject buttons visible for admin
7. Navigate to `/dashboard/settings` → profile edit works
8. Navigate to `/dashboard/analytics` → export button downloads CSV
9. Click dark mode toggle → theme switches and persists on reload
10. Logout → cookie cleared → accessing `/dashboard` redirects to `/`
