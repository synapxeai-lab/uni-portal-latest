import { useParams } from "react-router";
import { BookOpen, ChevronRight, LayoutList, User, Users } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { ListSkeleton } from "@/components/states/skeletons";
import Link from "@/components/ui/link";
import { BackLink, DetailHeader } from "@/components/classic/classic";
import { QueryView } from "@/app/route-states";
import { useDepartment, useProgrammeLookup } from "@/features/academics/api";

/**
 * One diploma (admin): an exact replica of the old University Portal's
 * diploma page - the header card and two cards leading to its Sections and
 * Courses pages.
 */
export default function DiplomaPage() {
  const id = Number(useParams().id);
  const query = useDepartment(id);
  const programmeOf = useProgrammeLookup();
  const programme = programmeOf(query.data?.department.category ?? "");

  return (
    <PageContainer className="gap-0">
      <BackLink fallback={programme ? `/admin/programmes/${programme.slug}` : "/admin/programmes"}>
        Back to {programme ? programme.label : "Programmes"}
      </BackLink>
      <div className="mt-4">
        <QueryView query={query} loading={<ListSkeleton rows={4} />}>
          {({ department }) => {
            const sections = department.sections;
            const batchCount = new Set(sections.map((s) => s.batch)).size;
            const credits = department.courses.reduce((n, c) => n + c.creditHours, 0);
            const links = [
              {
                label: "Sections",
                icon: LayoutList,
                detail: `${sections.length} sections across ${batchCount} batches`,
                href: `/admin/diplomas/${id}/sections`,
              },
              { label: "Courses", icon: BookOpen, detail: `${department.courses.length} courses`, href: `/admin/diplomas/${id}/courses` },
            ];
            return (
              <>
                <DetailHeader
                  tile={department.code}
                  color={department.color}
                  bg={department.bg}
                  title={department.name}
                  subtitle={department.description}
                  meta={
                    <>
                      <span>
                        <LayoutList aria-hidden /> {programme?.label ?? "Programme"}
                      </span>
                      <span>
                        <User aria-hidden /> Head: {department.head}
                      </span>
                      <span>
                        <Users aria-hidden /> {department.studentsCount} students
                      </span>
                      <span>
                        <BookOpen aria-hidden /> {department.courses.length} courses · {credits} credits
                      </span>
                    </>
                  }
                />
                {/* .dept-nav-grid */}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                  {links.map(({ label, icon: Icon, detail, href }) => (
                    <Link
                      key={label}
                      href={href}
                      className="flex w-full items-center gap-[0.9rem] rounded-[10px] border border-border bg-card px-5 py-[1.1rem] text-left shadow-[0_1px_2px_rgba(23,31,50,.05)] transition-[box-shadow,border-color] hover:border-border-strong hover:shadow-[0_2px_8px_rgba(23,31,50,.07)]"
                    >
                      <span
                        className="inline-flex size-[42px] shrink-0 items-center justify-center rounded-md"
                        style={{ background: department.bg, color: department.color }}
                      >
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-[0.15rem]">
                        <span className="text-[0.95rem] font-bold text-foreground">{label}</span>
                        <span className="text-[0.78rem] text-muted-foreground">{detail}</span>
                      </span>
                      <ChevronRight className="size-[18px] shrink-0 text-border-strong" aria-hidden />
                    </Link>
                  ))}
                </div>
              </>
            );
          }}
        </QueryView>
      </div>
    </PageContainer>
  );
}
