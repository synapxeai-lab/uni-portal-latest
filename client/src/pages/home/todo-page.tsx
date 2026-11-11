import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { ListSkeleton, PageHeaderSkeleton } from "@/components/states/skeletons";
import { useTodoBoard } from "@/features/todo/api";
import { TodoBoard } from "@/features/todo/components/todo-board";
import { TodoClassroomFilter } from "@/features/todo/components/todo-classroom-filter";
import { TODO_CATEGORIES, type TodoCategory } from "@/features/todo/types";
import { QueryView } from "@/app/route-states";
import { useSearchParams } from "@/lib/navigation";

function TodoLoading() {
  return (
    <PageContainer>
      <PageHeaderSkeleton />
      <ListSkeleton rows={4} />
    </PageContainer>
  );
}

export default function TodoPage() {
  const searchParams = useSearchParams();
  const classroomId = searchParams.get("classroomId")?.trim() || undefined;
  const tab = searchParams.get("tab");
  const initialTab = TODO_CATEGORIES.includes(tab as TodoCategory)
    ? (tab as TodoCategory)
    : undefined;
  const board = useTodoBoard(classroomId);

  return (
    <QueryView query={board} loading={<TodoLoading />}>
      {({ items, classrooms }) => (
        <PageContainer>
          <SectionHeader
            title="To-do"
            description="Assignments across all your classes, organized by status."
          />
          <TodoClassroomFilter classrooms={classrooms} classroomId={classroomId} />
          <TodoBoard items={items} initialTab={initialTab} />
        </PageContainer>
      )}
    </QueryView>
  );
}
