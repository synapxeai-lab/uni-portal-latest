/** Academic records as the API returns them (dates revived to Date by lib/api.ts). */

export interface ProgrammeCategory {
  id: number;
  key: string;
  slug: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  bg: string;
  position: number;
}

export interface BatchDetail {
  name: string;
  year: number | null;
}

/** Per batch: its sections, the diplomas they are in, and its students (each counted once). */
export interface BatchCounts {
  sections: number;
  diplomas: number;
  students: number;
}

export interface ExtraFee {
  id: number;
  name: string;
  amount: number;
}

export interface SchemeEntry {
  id: number;
  type: string;
  component: "THEORY" | "PRACTICAL";
  weightage: number;
}

export interface TeacherRef {
  id: number;
  name: string;
  email: string;
  phone?: string;
}

export interface ClassroomRef {
  id: string;
  code: string;
  status: string;
}

export interface DepartmentRef {
  id: number;
  name: string;
  code: string;
  semester: number;
  category?: string;
  color?: string;
  bg?: string;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  creditHours: number;
  fee: number;
  discountRate: number;
  theoryPercent: number;
  departmentId: number;
  department?: DepartmentRef & { category: string };
  extraFees?: ExtraFee[];
  assessmentScheme?: SchemeEntry[];
  status: "ACTIVE" | "INACTIVE";
  totalFee?: number;
}

export interface SectionCourseLink {
  id: number;
  sectionId: number;
  courseId: number;
  teacherId: number | null;
  course: Course;
  teacher: TeacherRef | null;
  classroom?: ClassroomRef | null;
}

export interface SectionSummary {
  id: number;
  label: string;
  batch: string;
  departmentId: number;
  courseLinks: SectionCourseLink[];
  _count: { students: number };
}

export interface Department {
  id: number;
  name: string;
  code: string;
  color: string;
  bg: string;
  description: string;
  head: string;
  category: string;
  semester: number;
  discountRate: number;
  fee: number;
  netFee: number;
  studentsCount: number;
  courses: Course[];
  sections: SectionSummary[];
}

export interface CourseDetail extends Course {
  department: DepartmentRef & { category: string };
  extraFees: ExtraFee[];
  assessmentScheme: SchemeEntry[];
  sectionLinks: (Omit<SectionCourseLink, "course"> & {
    section: { id: number; label: string; batch: string; departmentId: number };
  })[];
}

export interface SectionStudent {
  id: number;
  name: string;
  rollNo: string;
  email: string;
  phone: string;
  batch: string;
  section: string;
}

export interface SectionDetail {
  id: number;
  label: string;
  batch: string;
  departmentId: number;
  department: DepartmentRef & { category: string };
  students: SectionStudent[];
  courseLinks: SectionCourseLink[];
}
