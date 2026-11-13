import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { BookOpen } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryView } from "@/app/route-states";
import { useRouter } from "@/lib/navigation";

import { useUniversityQuery } from "../api";

/** A course section the viewer keeps marks and attendance for. */
export interface TeachingOffering {
  sectionId: number;
  courseId: number;
  course: { id: number; code: string; name: string };
  section: { id: number; label: string; batch: string; department: { code: string } };
  teacher: { id: number; name: string } | null;
  students: number;
}

export const offeringLabel = (o: Pick<TeachingOffering, "course" | "section">) =>
  `${o.course.code} ${o.course.name} · ${o.section.department.code} ${o.section.batch}-${o.section.label}`;

/** Teacher: the sections they teach; admin: every offered course section. */
export const useTeachingOfferings = () => useUniversityQuery<{ offerings: TeachingOffering[] }>("/teaching/offerings");

export function PageLoading() {
  return (
    <PageContainer>
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-64 w-full" />
    </PageContainer>
  );
}

/** /marks or /attendance with no course section chosen: opens the first one. */
export function FirstOfferingRedirect({ base, title, description }: { base: string; title: string; description: string }) {
  const query = useTeachingOfferings();
  return (
    <QueryView query={query} loading={<PageLoading />}>
      {({ offerings }) =>
        offerings.length > 0 ? (
          <Navigate to={`${base}/${offerings[0].sectionId}/${offerings[0].courseId}`} replace />
        ) : (
          <PageContainer>
            <SectionHeader title={title} description={description} breadcrumbs={[{ label: title }]} />
            <EmptyState
              icon={BookOpen}
              title="No course sections yet"
              description="Course sections appear here once a course is offered and you're assigned to teach it."
            />
          </PageContainer>
        )
      }
    </QueryView>
  );
}

/** Switches the page to another course section the viewer teaches. */
export function OfferingPicker({ base, sectionId, courseId }: { base: string; sectionId: number; courseId: number }) {
  const offerings = useTeachingOfferings().data?.offerings ?? [];
  const router = useRouter();
  const value = `${sectionId}/${courseId}`;
  return (
    <label className="flex w-full max-w-xl flex-col gap-1 text-sm font-medium">
      Course section
      <Select value={value} onChange={(e) => router.push(`${base}/${e.target.value}`)} aria-label="Course section">
        {offerings.some((o) => `${o.sectionId}/${o.courseId}` === value) ? null : <option value={value}>Loading…</option>}
        {offerings.map((o) => (
          <option key={`${o.sectionId}/${o.courseId}`} value={`${o.sectionId}/${o.courseId}`}>
            {offeringLabel(o)} · {o.students} students
          </option>
        ))}
      </Select>
    </label>
  );
}

/** Two-way switch between a page's views, kept in the URL. */
export function ViewSwitch({ options }: { options: { label: string; href: string; active: boolean }[] }): ReactNode {
  const router = useRouter();
  return (
    <div role="tablist" className="inline-flex w-fit rounded-md border border-border p-0.5">
      {options.map((option) => (
        <button
          key={option.label}
          role="tab"
          aria-selected={option.active}
          onClick={() => router.replace(option.href)}
          className={
            option.active
              ? "rounded px-3 py-1.5 text-sm font-semibold bg-primary text-primary-foreground"
              : "rounded px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
