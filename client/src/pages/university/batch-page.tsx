import { useParams } from "react-router";
import { LayoutList, Plus } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "@/components/ui/link";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { universityAction, useDepartments, useProgrammeCategories } from "@/features/academics/api";
import { ColourTile, ordinal, runAction } from "@/features/academics/components/ui";

/** One batch: its sections in every diploma, grouped by programme. */
export default function BatchPage() {
  const batch = decodeURIComponent(useParams().batch ?? "");
  const query = useDepartments();
  const categories = useProgrammeCategories().data?.categories ?? [];

  return (
    <QueryView query={query} loading={<AdminLoading />}>
      {({ departments }) => (
        <PageContainer>
          <SectionHeader
            title={`Batch ${batch}`}
            description="Sections of this batch in every diploma."
            breadcrumbs={[{ label: "Batches", href: "/admin/batches" }, { label: batch }]}
          />
          {categories.map((category) => {
            const diplomas = departments.filter((d) => d.category === category.key);
            if (diplomas.length === 0) return null;
            return (
              <div key={category.key} className="flex flex-col gap-3">
                <h2 className="font-heading text-base font-bold">{category.label}</h2>
                <div className="flex flex-col gap-3">
                  {diplomas.map((diploma) => {
                    const sections = diploma.sections.filter((s) => s.batch === batch);
                    return (
                      <Card key={diploma.id} className="flex flex-col gap-3 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <ColourTile color={diploma.color} bg={diploma.bg} className="h-8 w-8 text-xs font-bold">
                              {ordinal(diploma.semester)}
                            </ColourTile>
                            <Link href={`/admin/diplomas/${diploma.id}`} className="font-semibold">
                              {diploma.name}
                            </Link>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              runAction(universityAction("post", "/sections", { departmentId: diploma.id, batch }))
                            }
                          >
                            <Plus /> Add section
                          </Button>
                        </div>
                        {sections.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No sections in this batch.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {sections.map((section) => (
                              <Link
                                key={section.id}
                                href={`/admin/sections/${section.id}`}
                                className="rounded-md border border-border px-3 py-2 text-sm hover:border-gold hover:bg-accent"
                              >
                                <span className="font-semibold">Section {section.label}</span>
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {section._count.students} students · {section.courseLinks.length} courses
                                </span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {departments.length === 0 ? <EmptyState icon={LayoutList} title="No diplomas yet" /> : null}
        </PageContainer>
      )}
    </QueryView>
  );
}
