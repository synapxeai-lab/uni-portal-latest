import { Suspense, useEffect, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { AxiosError } from "axios";

import { AdminShell } from "@/components/admin/admin-shell";
import { ForbiddenToast } from "@/components/admin/forbidden-toast";
import { PageContainer } from "@/components/page/page-container";
import { PageHeaderSkeleton, ListSkeleton, PageSkeleton } from "@/components/states/skeletons";
import { ErrorState } from "@/components/states/error-state";
import { Shell } from "@/components/shell/shell";
import { UserRole } from "@portal/shared/enums";
import { useSession } from "@/lib/auth";

import { RouteErrorBoundary } from "./route-states";

const CHANGE_PASSWORD_PATH = "/change-password";

export function AppLoading() {
  return (
    <PageContainer>
      <PageSkeleton />
    </PageContainer>
  );
}

export function AdminLoading() {
  return (
    <PageContainer>
      <PageHeaderSkeleton />
      <ListSkeleton rows={8} />
    </PageContainer>
  );
}

function usePlatformTitle(platformName: string | undefined) {
  useEffect(() => {
    if (platformName) {
      document.title = platformName;
    }
  }, [platformName]);
}

/**
 * Loads the session once (cached for the whole visit) and applies the route
 * guards the Next.js proxy used to: signed out -> /login, pending forced
 * password change -> /change-password, wrong role -> /dashboard?denied=...
 */
function SessionGate({
  loading,
  allow,
  children,
}: {
  loading: ReactNode;
  allow?: { roles: UserRole[]; denied: string };
  children: (session: NonNullable<ReturnType<typeof useSession>["data"]>) => ReactNode;
}) {
  const { pathname } = useLocation();
  const session = useSession();
  usePlatformTitle(session.data?.platformName);

  if (session.isPending) {
    return <>{loading}</>;
  }
  if (session.isError) {
    const status = session.error instanceof AxiosError ? session.error.response?.status : undefined;
    if (status === 401 || status === 403) {
      return <Navigate to="/login" replace />;
    }
    return (
      <PageContainer>
        <ErrorState onRetry={() => void session.refetch()} />
      </PageContainer>
    );
  }

  const data = session.data;
  if (data.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }
  if (allow && !allow.roles.includes(data.user.role)) {
    return <Navigate to={`/dashboard?denied=${allow.denied}`} replace />;
  }

  return <>{children(data)}</>;
}

/** The signed-in teacher/student shell (and admins on non-admin pages). */
export function AppLayout() {
  const { pathname } = useLocation();
  return (
    <SessionGate loading={<AppLoading />}>
      {(session) => (
        <Shell
          user={session.user}
          initialUnreadCount={session.unreadNotificationCount}
          platformName={session.platformName}
        >
          <ForbiddenToast />
          <RouteErrorBoundary resetKey={pathname}>
            <Suspense fallback={<AppLoading />}>
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </Shell>
      )}
    </SessionGate>
  );
}

/** /admin/* - admins only. */
export function AdminLayout() {
  const { pathname } = useLocation();
  return (
    <SessionGate loading={<AdminLoading />} allow={{ roles: [UserRole.ADMIN], denied: "admin" }}>
      {(session) => (
        <AdminShell user={session.user} platformName={session.platformName}>
          <RouteErrorBoundary resetKey={pathname}>
            <Suspense fallback={<AdminLoading />}>
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </AdminShell>
      )}
    </SessionGate>
  );
}

/** Restricts a group of in-shell routes to some roles (e.g. /review). */
export function RoleRoute({ roles, denied }: { roles: UserRole[]; denied: string }) {
  const session = useSession();
  if (session.data && !roles.includes(session.data.user.role)) {
    return <Navigate to={`/dashboard?denied=${denied}`} replace />;
  }
  return <Outlet />;
}
