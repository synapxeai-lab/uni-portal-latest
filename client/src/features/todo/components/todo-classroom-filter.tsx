import { usePathname, useRouter, useSearchParams } from "@/lib/navigation";

import { Select } from "@/components/ui/select";

import type { TodoClassroomOption } from "../types";

interface TodoClassroomFilterProps {
  classrooms: TodoClassroomOption[];
  classroomId?: string;
}

/** The "All Classes" dropdown - URL-driven (`?classroomId=`), same client-navigation convention as CalendarFilterBar/ReviewFilterBar. Default selection is "All Classes" (an unset param). */
export function TodoClassroomFilter({ classrooms, classroomId }: TodoClassroomFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("classroomId", value);
    } else {
      params.delete("classroomId");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select
      aria-label="Filter by classroom"
      value={classroomId ?? ""}
      onChange={(event) => handleChange(event.target.value)}
      className="sm:w-64"
    >
      <option value="">All classes</option>
      {classrooms.map((classroom) => (
        <option key={classroom.id} value={classroom.id}>
          {classroom.title}
        </option>
      ))}
    </Select>
  );
}
