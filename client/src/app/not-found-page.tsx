import { PageContainer } from "@/components/page/page-container";

/** In-shell 404 for unknown routes and missing records. */
export function NotFoundPage() {
  return (
    <PageContainer>
      <div className="py-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you are looking for doesn&apos;t exist or you don&apos;t have access to it.
        </p>
      </div>
    </PageContainer>
  );
}
