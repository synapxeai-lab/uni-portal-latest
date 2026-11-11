# Authentication Architecture Plan

This document outlines the implementation plan for adding authentication to GCR using Auth.js, the Prisma Adapter, and PostgreSQL. The plan assumes the current database foundation remains the source of truth and that authentication will be introduced as a dedicated layer rather than as ad-hoc logic.

## 1. Current database fit

The existing schema already provides a strong base for authentication:

- The User model already stores identity and profile data such as name, email, passwordHash, role, and avatarUrl.
- The UserRole enum already supports ADMIN, TEACHER, and STUDENT.
- PostgreSQL is already configured as the persistence layer.

The main gap is that Auth.js expects a more complete auth-oriented schema than the current User table alone. The implementation plan therefore treats the current User model as the core identity record and adds the standard Auth.js tables through Prisma.

## 2. Proposed authentication architecture

### Core approach

- Use Auth.js for authentication flows and session handling.
- Use the Prisma Adapter so Auth.js writes directly into PostgreSQL.
- Keep the existing User table as the primary application identity record.
- Reuse the existing UserRole enum for role-based authorization.
- Use database-backed sessions for predictable server-side access control.

### Recommended auth strategy

- Credentials-based login for the initial release.
- Password hashing handled by Auth.js-compatible helpers or a dedicated service layer.
- Session persistence through Auth.js database sessions.
- Route-level protection handled by middleware and server-side authorization helpers.
- OAuth providers planned as a future extension through the Account model.

## 3. Implementation plan

### Phase 1 — Schema preparation

Prepare the Prisma schema for Auth.js without implementing the full auth flow yet.

#### Planned schema additions

- Add Auth.js-required models:
  - Account
  - Session
  - VerificationToken
- Add supporting fields to User if needed:
  - emailVerified
  - image
- Keep the existing passwordHash field for credentials-based sign-in.
- Preserve the existing role field and enum for authorization.

#### Notes

- The current User model is already close to what Auth.js needs, but the adapter expects a richer auth model to support sessions, account linking, and email verification.
- The implementation should be treated as a schema extension rather than a replacement of the existing user model.

### Phase 2 — Auth.js configuration

Create the foundational Auth.js configuration in a dedicated auth module.

#### Planned files

- src/auth/config.ts
- src/auth/index.ts
- src/auth/credentials.ts
- src/auth/session.ts

#### Planned configuration details

- Register the Prisma Adapter with the existing Prisma client.
- Configure the Credentials provider for email/password login.
- Use PostgreSQL-backed sessions.
- Set a consistent session strategy for the application.
- Configure trusted redirects and base URL handling.

#### Design principles

- Keep auth configuration centralized.
- Avoid mixing auth logic directly into route handlers or UI components.
- Keep provider-specific logic isolated so credentials and future OAuth providers use the same core auth flow.

## 4. User registration

### Goal

Allow new users to create an account through a registration flow that creates both an application user and the auth identity needed by Auth.js.

### Planned flow

1. User submits registration form with name, email, password, and optional role.
2. Validate input on the server.
3. Check whether the email already exists.
4. Hash the password.
5. Create a new User record in the database.
6. Store the password hash in the existing passwordHash field.
7. Optionally create a default classroom membership or onboarding state later, but not in the initial implementation.
8. Return a success response and redirect to login or onboarding.

### Important design decisions

- The initial registration flow should be explicit and simple.
- The default role for self-registered users should be STUDENT unless the product later introduces teacher invite flows.
- Teacher and admin creation should be restricted to controlled administrative paths rather than public signup.

### Suggested server-side responsibilities

- Input validation
- Password hashing
- Duplicate email checks
- User creation
- Error handling and friendly feedback

## 5. Login

### Goal

Allow a user to sign in with email and password and establish a valid session.

### Planned flow

1. User submits credentials.
2. Auth.js credentials provider resolves the user by email.
3. The system verifies the provided password against the stored hash.
4. If successful, Auth.js creates a session and establishes the authenticated state.
5. The authenticated user is available to middleware, route handlers, and server components.

### Design notes

- Keep login logic in the Auth.js credentials provider rather than duplicating it elsewhere.
- Use the same User record for both authentication identity and application-level profile data.
- Treat login failures consistently and avoid leaking whether the email or password was incorrect.

## 6. Session management

### Goal

Maintain a reliable, secure, and easy-to-audit session model across the application.

### Plan

- Use Auth.js database sessions.
- Store session metadata in the Session table.
- Use the session record as the authoritative source for active auth state.
- Ensure session expiration and invalidation are handled through Auth.js defaults and Prisma-backed cleanup.

### Session responsibilities

- Create session on successful login
- Refresh or rotate session data as needed
- Invalidate on logout
- Invalidate on password change or security-sensitive actions
- Support future “remember me” behavior if needed

### Operational considerations

- Add a clear logout flow that terminates the session record.
- Keep session handling centralized so future changes do not require touching many routes.

## 7. Role handling

### Goal

Use the existing role model to control access to application areas.

### Plan

- Reuse the existing UserRole enum: ADMIN, TEACHER, STUDENT.
- Keep role checks centralized in a small authorization helper layer.
- Do not scatter role checks across UI and server code.

### Role strategy

- ADMIN: full platform access
- TEACHER: classroom and content management access
- STUDENT: classroom participation access

### Recommended pattern

- Middleware should enforce authentication presence.
- Server-side authorization helpers should enforce role eligibility.
- UI should display controls based on the user’s role, but never be the only guard.

## 8. Route protection

### Goal

Protect routes based on authentication state and authorization needs.

### Plan

Use a layered approach:

1. Public routes remain accessible without authentication.
2. Authenticated-only routes require a valid session.
3. Role-specific routes require a matching role.
4. Classroom-specific routes should eventually require both authentication and classroom membership.

### Suggested route groups

- Public: landing page, login, register, password reset, marketing pages
- Authenticated: dashboard, account settings, notifications
- Teacher/Admin: classroom management, moderation, admin panels
- Student: coursework and submission flows

### Protection model

- Middleware should handle the first gate quickly.
- Server components and route handlers should enforce the final authorization decision.
- The rule should be: middleware protects the entry point; server-side helpers protect the business action.

## 9. Middleware

### Goal

Enforce authentication and route access as early as possible.

### Plan

Create a middleware layer that:

- Checks whether the request has a valid Auth.js session.
- Allows public routes to bypass authentication.
- Redirects unauthenticated users to login where needed.
- Redirects authenticated users away from auth pages such as login and register.
- Enforces role-based routing for protected admin and teacher areas.

### Middleware responsibilities

- Define which routes are public, private, and role-restricted
- Prevent access to protected areas before the page renders
- Keep the logic lightweight and declarative

### Suggested structure

- Public routes: /, /login, /register, /about
- Private routes: /dashboard, /account, /classes
- Restricted routes: /admin, /teacher, /admin/*

## 10. Authorization helpers

### Goal

Provide a small, reusable layer for authorization decisions.

### Plan

Create helper functions such as:

- requireUser()
- requireRole(role)
- requireAnyRole(roles)
- canManageClassroom(user, classroomId)
- canViewClassroom(user, classroomId)

### Design approach

- Keep helpers server-only.
- Resolve authorization from the current authenticated session plus database context.
- Reuse them from server actions, route handlers, and server components.
- Avoid duplicating permission logic in multiple files.

### Recommended future extension

As classroom membership becomes important, these helpers should eventually check membership records and role assignments in the ClassroomMembership table rather than only the global User role.

## 11. Future OAuth support

### Goal

Design the system so credentials-based auth can expand to OAuth providers later without reworking the core architecture.

### Plan

- Use the Account model to support multiple providers for the same user.
- Keep provider-specific configuration isolated behind the Auth.js config layer.
- Support account linking so a user can connect Google or GitHub later without creating duplicate accounts.
- Keep the same core session and authorization layer regardless of provider type.

### Suggested future providers

- Google
- GitHub
- Microsoft

### Migration-friendly design

- OAuth should be introduced as an extension of the same User record rather than a parallel identity system.
- The role and profile information should remain attached to the primary User model.

## 12. Suggested implementation order

1. Extend the Prisma schema with Auth.js-compatible models and fields.
2. Configure Auth.js with Prisma Adapter and the credentials provider.
3. Implement registration and login flows.
4. Add session handling and logout.
5. Add middleware for public and protected routes.
6. Introduce authorization helpers for role-based checks.
7. Add OAuth providers later through the Account model.

## 13. Recommended file layout

A clean structure for the first implementation would be:

- src/auth/config.ts
- src/auth/index.ts
- src/auth/credentials.ts
- src/auth/session.ts
- src/lib/auth/permissions.ts
- src/lib/auth/guards.ts
- src/app/login/page.tsx
- src/app/register/page.tsx
- src/middleware.ts

## 14. Risks and guardrails

- Avoid mixing auth concerns into the UI layer.
- Keep role checks server-side.
- Avoid relying on client-side checks for authorization.
- Treat the User table as the application identity record and the Auth.js tables as auth infrastructure.
- Keep the initial release focused on credentials login and session persistence before introducing social providers.
