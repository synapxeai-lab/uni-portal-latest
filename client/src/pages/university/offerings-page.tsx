import { useState } from "react";
import { ChevronRight, Layers, Sparkles } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "@/components/ui/link";
import { Select } from "@/components/ui/select";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { queryString, universityAction, useProgrammeCategories, useUniversityQuery } from "@/features/academics/api";
import { ColourTile, ordinal, runAction } from "@/features/academics/components/ui";

interface OfferingOverview {
  term: { semester: string; year: number };
  departments: {
    id: number;
    name: string;
    code: string;
    category: string;
    semester: number;
    color: string;
    bg: string;
    courseCount: number;
    currentBatches: string[];
    batches: { batch: string; sections: number; offeredCourses: number }[];
  }[];
}

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

/**
 * Offer courses: each diploma's batches and how many of its courses they're
 * offered. A batch studies one diploma per term ("current").
 */
export default function OfferingsPage() {
  const [category, setCategory] = useState("");
  const categories = useProgrammeCategories().data?.categories ?? [];
  const query = useUniversityQuery<OfferingOverview>(`/offerings${queryString({ category })}`, { keepPrevious: true });
  const [pending, setPending] = useState(false);

  return (
    <PageContainer>
      <SectionHeader
        title="Offer courses"
        description="Offering a course to a batch gives each of its sections a classroom. Teachers are assigned per section."
        breadcrumbs={[{ label: "Offer courses" }]}
        actions={
          <Button
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await runAction(universityAction("post", "/offerings/current"));
              setPending(false);
            }}
          >
            <Sparkles /> Offer this term's diplomas
          </Button>
        }
      />
      <Select className="sm:max-w-xs" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Programme">
        <option value="">All programmes</option>
        {categories.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </Select>
      <QueryView query={query} loading={<AdminLoading />}>
        {({ term, departments }) => (
          <>
            <p className="text-sm text-muted-foreground">
              Current term: <span className="font-semibold text-foreground">{titleCase(term.semester)} {term.year}</span>
            </p>
            {departments.length === 0 ? (
              <EmptyState icon={Layers} title="No diplomas" />
            ) : (
              <div className="flex flex-col gap-3">
                {departments.map((diploma) => (
                  <Card key={diploma.id} className="flex flex-col gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <ColourTile color={diploma.color} bg={diploma.bg} className="h-9 w-9 text-xs font-bold">
                        {ordinal(diploma.semester)}
                      </ColourTile>
                      <div className="flex flex-col">
                        <span className="font-semibold">{diploma.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {diploma.code} · {diploma.courseCount} courses
                        </span>
                      </div>
                    </div>
                    {diploma.batches.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No batches have sections in this diploma yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {diploma.batches.map(({ batch, sections, offeredCourses }) => (
                          <Link
                            key={batch}
                            href={`/admin/offerings/${diploma.id}/${encodeURIComponent(batch)}`}
                            className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:border-gold hover:bg-accent"
                          >
                            <span className="font-semibold">Batch {batch}</span>
                            <span className="text-xs text-muted-foreground">
                              {offeredCourses}/{diploma.courseCount} courses · {sections} sections
                            </span>
                            {diploma.currentBatches.includes(batch) ? <Badge variant="gold">This term</Badge> : null}
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </Link>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </QueryView>
    </PageContainer>
  );
}
