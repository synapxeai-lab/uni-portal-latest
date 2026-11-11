import { useLocation } from "react-router";

import { PageContainer } from "@/components/page/page-container";
import { Pagination } from "@/components/page/pagination";
import { SectionHeader } from "@/components/page/section-header";
import { PageHeaderSkeleton } from "@/components/states/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { useReviewQueue } from "@/features/review/api";
import { ReviewFilterBar } from "@/features/review/components/review-filter-bar";
import { ReviewQueueTable } from "@/features/review/components/review-queue-table";
import { ReviewSummaryCards } from "@/features/review/components/review-summary-cards";
import { parseReviewFilters, type RawSearchParams } from "@/features/review/lib/review-params";
import { QueryView } from "@/app/route-states";
import { useSearchParams } from "@/lib/navigation";

function ReviewLoading() {
  return (
    <PageContainer>
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </PageContainer>
  );
}

/** Teacher/admin review queue - filters, sort and page all live in the URL. */
export default function ReviewPage() {
  const { search } = useLocation();
  const searchParams = useSearchParams();
  const raw: RawSearchParams = Object.fromEntries(searchParams.entries());
  const filters = parseReviewFilters(raw);
  const queue = useReviewQueue(search);

  return (
    <QueryView query={queue} loading={<ReviewLoading />}>
      {(result) => (
        <PageContainer>
          <SectionHeader
            title="To review"
            description="Student submissions across your classes that need grading, are late, or were recently returned."
          />

          <ReviewSummaryCards summary={result.summary} />

          <ReviewFilterBar filterOptions={result.filterOptions} />

          <ReviewQueueTable rows={result.rows} currentSort={filters.sort} searchParams={raw} />

          {result.total > 0 ? (
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              total={result.total}
              pageSize={result.pageSize}
              itemLabel="submissions"
            />
          ) : null}
        </PageContainer>
      )}
    </QueryView>
  );
}
