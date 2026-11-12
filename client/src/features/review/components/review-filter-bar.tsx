import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "@/lib/navigation";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

import type { ReviewFilterOptions, ReviewSortKey } from "../types";

const SORT_OPTIONS: { value: ReviewSortKey; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "dueDate", label: "Due date" },
  { value: "studentName", label: "Student name" },
  { value: "assignmentName", label: "Assignment name" },
];

const STATUS_OPTIONS = [
  { value: "SUBMITTED", label: "Submitted" },
  { value: "LATE", label: "Late" },
  { value: "GRADED", label: "Graded" },
  { value: "RETURNED", label: "Returned for revision" },
];

interface ReviewFilterBarProps {
  filterOptions: ReviewFilterOptions;
}

export function ReviewFilterBar({ filterOptions }: ReviewFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const classroomId = searchParams.get("classroomId") ?? "";
  const assignmentId = searchParams.get("assignmentId") ?? "";
  const studentId = searchParams.get("studentId") ?? "";
  const status = searchParams.get("status") ?? "";
  const dueBefore = searchParams.get("dueBefore") ?? "";
  const sort = searchParams.get("sort") ?? "newest";

  const visibleAssignments = useMemo(
    () =>
      classroomId
        ? filterOptions.assignments.filter((assignment) => assignment.classroomId === classroomId)
        : filterOptions.assignments,
    [filterOptions.assignments, classroomId],
  );

  const visibleStudents = useMemo(() => {
    const matching = classroomId
      ? filterOptions.students.filter((student) => student.classroomId === classroomId)
      : filterOptions.students;

    // filterOptions.students has one row per (student, classroom) membership -
    // needed so the classroom-scoped filter above works, but a student in
    // several manageable classrooms would otherwise appear once per
    // classroom in the unscoped "All classrooms" dropdown, with duplicate
    // option keys/values as a result.
    const seen = new Set<string>();
    return matching.filter((student) => {
      if (seen.has(student.id)) {
        return false;
      }
      seen.add(student.id);
      return true;
    });
  }, [filterOptions.students, classroomId]);

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Select
        aria-label="Filter by classroom"
        value={classroomId}
        onChange={(event) =>
          updateParams({
            classroomId: event.target.value || null,
            assignmentId: null,
            studentId: null,
          })
        }
        className="sm:w-48"
      >
        <option value="">All classrooms</option>
        {filterOptions.classrooms.map((classroom) => (
          <option key={classroom.id} value={classroom.id}>
            {classroom.title}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Filter by assignment"
        value={assignmentId}
        onChange={(event) => updateParams({ assignmentId: event.target.value || null })}
        className="sm:w-48"
      >
        <option value="">All assignments</option>
        {visibleAssignments.map((assignment) => (
          <option key={assignment.id} value={assignment.id}>
            {assignment.title}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Filter by student"
        value={studentId}
        onChange={(event) => updateParams({ studentId: event.target.value || null })}
        className="sm:w-44"
      >
        <option value="">All students</option>
        {visibleStudents.map((student) => (
          <option key={student.id} value={student.id}>
            {student.name}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Filter by status"
        value={status}
        onChange={(event) => updateParams({ status: event.target.value || null })}
        className="sm:w-40"
      >
        <option value="">All statuses</option>
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        Due before
        <Input
          type="date"
          value={dueBefore}
          onChange={(event) => updateParams({ dueBefore: event.target.value || null })}
          className="w-40"
        />
      </label>

      <Select
        aria-label="Sort by"
        value={sort}
        onChange={(event) => updateParams({ sort: event.target.value || null })}
        className="sm:w-44 sm:ml-auto"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            Sort: {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
