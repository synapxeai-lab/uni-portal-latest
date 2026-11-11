import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { useTimetableClashes } from "@/features/timetable/api";
import { ClashList } from "@/features/timetable/components/clash-list";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { useSearchParams } from "@/lib/navigation";

export default function AdminTimetablePage() {
  const filter = useSearchParams().get("status") === "all" ? "all" : "pending";
  const clashes = useTimetableClashes(filter);

  return (
    <QueryView query={clashes} loading={<AdminLoading />}>
      {(data) => (
        <PageContainer>
          <SectionHeader
            title="Timetable clashes"
            description="Teachers requested a slot that the section already has a class in. Move the blocked class to a free slot to resolve it."
            breadcrumbs={[{ label: "Timetable clashes" }]}
            actions={
              <Button asChild variant="outline" size="sm">
                <Link href={filter === "all" ? "/admin/timetable" : "/admin/timetable?status=all"}>
                  {filter === "all" ? "Show pending only" : "Show all"}
                </Link>
              </Button>
            }
          />
          <ClashList clashes={data.clashes} rooms={data.rooms} />
        </PageContainer>
      )}
    </QueryView>
  );
}
