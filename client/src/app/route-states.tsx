import { Component, type ErrorInfo, type ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { PageContainer } from "@/components/page/page-container";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { UserRoundX } from "lucide-react";

import { getApiError, isNotFoundError } from "@/lib/api";

import { NotFoundPage } from "./not-found-page";

/**
 * Renders a page from one query: the route's skeleton while it loads for the
 * first time, the page's own not-found view on 404, the shared error card
 * (with retry) on any other failure. Once data is cached, revisits render
 * immediately and background refreshes never flash the skeleton.
 */
export function QueryView<T>({
  query,
  loading,
  notFound,
  children,
}: {
  query: UseQueryResult<T>;
  loading: ReactNode;
  notFound?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.data !== undefined) {
    return <>{children(query.data)}</>;
  }
  if (query.isError) {
    // A teacher/student login without its academic record (e.g. created on the
    // Users page): say so, rather than "page not found".
    if (getApiError(query.error)?.code === "NO_PROFILE") {
      return (
        <PageContainer>
          <EmptyState
            icon={UserRoundX}
            title="Your academic record isn't set up yet"
            description={`${getApiError(query.error)!.message} Once it is, your courses, registration, attendance, marks and fees appear here.`}
          />
        </PageContainer>
      );
    }
    if (isNotFoundError(query.error)) {
      return <>{notFound !== undefined ? notFound : <NotFoundPage />}</>;
    }
    return (
      <PageContainer>
        <ErrorState onRetry={() => void query.refetch()} />
      </PageContainer>
    );
  }
  return <>{loading}</>;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Catches render errors in a page so the shell stays usable (Next's error.tsx). */
export class RouteErrorBoundary extends Component<
  { children: ReactNode; resetKey: string },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  componentDidUpdate(previous: { resetKey: string }) {
    // Navigating elsewhere clears the error.
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <PageContainer>
          <ErrorState onRetry={() => this.setState({ error: null })} />
        </PageContainer>
      );
    }
    return this.props.children;
  }
}
