import { useState } from "react";
import { useParams } from "react-router";
import { BookOpen, CircleCheck, Clock, Mail, Pencil, Phone, Wallet } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { ListSkeleton } from "@/components/states/skeletons";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BackLink,
  BlockHeading,
  ClassicButton,
  ClassicConfirm,
  DetailsField,
  DetailsSection,
  NavLink,
  RowButton,
  TableEmpty,
} from "@/components/classic/classic";
import { QueryView } from "@/app/route-states";
import {
  universityAction,
  useProgrammeLookup,
  useUniversityQuery,
} from "@/features/academics/api";
import { ClassicStudentModal } from "@/features/academics/components/classic-student-modal";
import type { StudentRecord } from "@/features/academics/components/people-dialogs";
import { ordinal, runAction, TableCard } from "@/features/academics/components/ui";
import { cn } from "@/lib/utils";

/**
 * One student's record (admin): an exact replica of the old University
 * Portal's student page - a coloured header card, the five details sections,
 * registered courses by term and the student's fee challans.
 */

interface StudentDetail {
  student: StudentRecord;
  groups: {
    semester: string;
    year: number;
    semesterNumber: number | null;
    diploma: { name: string; code: string } | null;
    courses: {
      enrollmentId: number;
      id: number;
      code: string;
      name: string;
      creditHours: number;
      section: { id: number; label: string };
      teacher: { name: string; email: string } | null;
      grade: string | null;
    }[];
  }[];
}

interface Challan {
  id: number;
  amount: number;
  accountNumber: string;
  status: "UNPAID" | "PENDING_APPROVAL" | "PAID";
  semester: number | null;
  registration: { semester: string; year: number };
  diploma: { name: string } | null;
}

const SEMESTER_LABELS: Record<string, string> = { SPRING: "Spring", SUMMER: "Summer", FALL: "Fall" };
const GENDER_LABELS: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };
// Date of birth is stored as UTC midnight: format in UTC so it never shows the day before.
const formatDob = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const formatPKR = (n: number) => `Rs. ${(Number(n) || 0).toLocaleString("en-PK")}`;
const calendarLabel = (c: Challan) => `${SEMESTER_LABELS[c.registration.semester]} ${c.registration.year}`;
const challanLabel = (c: Challan) =>
  c.semester && c.semester >= 1 && c.semester <= 8 ? `${ordinal(c.semester)} Semester — ${calendarLabel(c)}` : calendarLabel(c);
const muted = "whitespace-nowrap text-[0.8rem] text-muted-foreground";

const CHALLAN_STATUS: Record<Challan["status"], { label: string; className: string }> = {
  UNPAID: { label: "Unpaid", className: "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c] dark:border-destructive-border dark:bg-destructive-soft dark:text-destructive" },
  PENDING_APPROVAL: { label: "Awaiting Approval", className: "border-[#fde68a] bg-[#fefce8] text-[#a16207] dark:border-warning-border dark:bg-warning-soft dark:text-warning" },
  PAID: { label: "Paid", className: "border-[#bbf7d0] bg-[#dcfce7] text-[#166534] dark:border-success-border dark:bg-success-soft dark:text-success" },
};

/** Fees on the student page: one row per semester's challan, with paid/outstanding totals and Approve. */
function StudentFees({ studentId }: { studentId: number }) {
  const query = useUniversityQuery<{ challans: Challan[] }>(`/challans?studentId=${studentId}`);
  const [confirm, setConfirm] = useState<Challan | null>(null);
  const [approving, setApproving] = useState<number | null>(null);
  const challans = query.data?.challans ?? [];
  const total = challans.reduce((sum, c) => sum + c.amount, 0);
  const paid = challans.filter((c) => c.status === "PAID").reduce((sum, c) => sum + c.amount, 0);

  async function approve() {
    if (!confirm) return;
    const challan = confirm;
    setConfirm(null);
    setApproving(challan.id);
    await runAction(universityAction("put", `/challans/${challan.id}/approve`), "Payment approved.");
    setApproving(null);
  }

  return (
    <>
      <BlockHeading
        className="mb-[0.9rem] mt-7"
        meta={
          challans.length > 0 ? (
            <>
              {" "}
              · Paid {formatPKR(paid)} of {formatPKR(total)}
              {total - paid > 0 ? (
                <>
                  {" "}
                  · <span className="text-[#b91c1c] dark:text-destructive">{formatPKR(total - paid)} outstanding</span>
                </>
              ) : null}
            </>
          ) : null
        }
      >
        Fees
      </BlockHeading>
      <QueryView query={query} loading={<ListSkeleton rows={3} />}>
        {() =>
          challans.length === 0 ? (
            <TableEmpty icon={Wallet}>No fee challans yet. One is generated each semester the student registers for courses.</TableEmpty>
          ) : (
            <TableCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Semester</TableHead>
                    <TableHead>Diploma</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Account No.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead aria-label="Actions" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {challans.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{challanLabel(c)}</TableCell>
                      <TableCell className="whitespace-normal">{c.diploma ? c.diploma.name : <span className={muted}>—</span>}</TableCell>
                      <TableCell className="font-semibold">{formatPKR(c.amount)}</TableCell>
                      <TableCell className={muted}>{c.accountNumber}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-block whitespace-nowrap rounded-[20px] border px-[0.6rem] py-[0.2rem] text-[0.68rem] font-bold tracking-[0.03em]",
                            CHALLAN_STATUS[c.status].className,
                          )}
                        >
                          {c.status === "PAID" ? <CircleCheck className="mr-1 inline size-3 align-[-2px]" aria-hidden /> : null}
                          {c.status === "PENDING_APPROVAL" ? <Clock className="mr-1 inline size-3 align-[-2px]" aria-hidden /> : null}
                          {CHALLAN_STATUS[c.status].label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {c.status === "PENDING_APPROVAL" ? (
                          <RowButton
                            kind="edit"
                            icon={CircleCheck}
                            label={approving === c.id ? "Approving…" : "Approve"}
                            disabled={approving === c.id}
                            onClick={() => setConfirm(c)}
                          />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableCard>
          )
        }
      </QueryView>
      <ClassicConfirm
        open={confirm !== null}
        title="Approve Payment"
        message={confirm ? `Mark the ${challanLabel(confirm)} fee of ${formatPKR(confirm.amount)} as paid?` : ""}
        confirmLabel="Approve"
        confirmVariant="primary"
        onConfirm={approve}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

export default function StudentPage() {
  const id = Number(useParams().id);
  const query = useUniversityQuery<StudentDetail>(`/students/${id}`);
  const programmeOf = useProgrammeLookup();
  const [editing, setEditing] = useState(false);

  return (
    <PageContainer className="gap-0">
      <BackLink fallback="/admin/students">Back to Students</BackLink>
      <div className="mt-4">
        <QueryView query={query} loading={<ListSkeleton rows={6} />}>
          {({ student, groups }) => {
            const dept = student.currentDiploma;
            const programme = programmeOf(student.programme);
            const allCourses = groups.flatMap((g) => g.courses);
            const totalCredits = allCourses.reduce((sum, c) => sum + c.creditHours, 0);
            const initials = student.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return (
              <>
                {/* .dept-detail-header: the diploma's colour on the left edge and the initials tile. */}
                <div
                  className="mb-6 flex gap-[1.1rem] rounded-[10px] border border-l-4 border-border bg-card p-[1.35rem] shadow-[0_1px_2px_rgba(23,31,50,.05)] max-[480px]:flex-col max-[480px]:p-[1.1rem]"
                  style={{ borderLeftColor: dept?.bg }}
                >
                  <div
                    className="flex h-[52px] min-w-[52px] shrink-0 items-center justify-center self-start whitespace-nowrap rounded-md px-[0.6rem] text-[0.9rem] font-extrabold"
                    style={{ background: dept?.bg, color: dept?.color }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="mb-[0.35rem] font-heading text-[1.25rem] font-extrabold text-foreground">{student.name}</h1>
                    <p className="mb-[0.6rem] text-[0.8rem] text-muted-foreground">
                      {student.rollNo} · Batch {student.batch} · Section {student.section}
                      {programme ? <> · {programme.label}</> : null}
                      {dept ? (
                        <>
                          {" "}
                          ·{" "}
                          <NavLink href={`/admin/diplomas/${dept.id}`} className="font-semibold text-foreground">
                            {dept.name}
                          </NavLink>
                        </>
                      ) : null}
                    </p>
                    <div className="flex flex-wrap gap-5 text-[0.78rem] text-muted-foreground [&>span]:inline-flex [&>span]:items-center [&>span]:gap-[0.35rem]">
                      <span>
                        <Mail className="size-[13px]" aria-hidden /> {student.email}
                      </span>
                      <span>
                        <Phone className="size-[13px]" aria-hidden /> {student.phone}
                      </span>
                      <span>
                        <BookOpen className="size-[13px]" aria-hidden /> {allCourses.length} courses · {totalCredits} CR registered
                      </span>
                    </div>
                  </div>
                  <ClassicButton variant="outline" onClick={() => setEditing(true)} className="shrink-0 self-start">
                    <Pencil className="size-[14px]" /> Edit
                  </ClassicButton>
                </div>

                <div className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 max-[400px]:grid-cols-1">
                  <DetailsSection title="Personal Information">
                    <DetailsField label="Full Name" value={student.name} />
                    <DetailsField label="CNIC" value={student.cnic} />
                    <DetailsField label="Date of Birth" value={student.dob && formatDob(student.dob)} />
                    <DetailsField label="Gender" value={student.gender && GENDER_LABELS[student.gender]} />
                  </DetailsSection>
                  <DetailsSection title="Previous Education">
                    <DetailsField label="Last Qualification" value={student.lastQualification} />
                    <DetailsField label="Passing Year" value={student.passingYear} />
                    <DetailsField label="Grade" value={student.grade} />
                    <DetailsField label="Board / University" value={student.university} />
                  </DetailsSection>
                  <DetailsSection title="Academic">
                    <DetailsField label="Roll No" value={student.rollNo} />
                    <DetailsField label="Programme" value={programme?.label} />
                    <DetailsField label="Current Diploma" value={dept && `${ordinal(dept.semester)} Semester · ${dept.name} (${dept.code})`} />
                    <DetailsField label="Batch" value={student.batch} />
                    <DetailsField label="Section" value={student.section} />
                  </DetailsSection>
                  <DetailsSection title="Contact">
                    <DetailsField label="Email" value={student.email} />
                    <DetailsField label="Phone" value={student.phone} />
                    <DetailsField label="Address" value={student.address} wide />
                  </DetailsSection>
                  <DetailsSection title="Guardian">
                    <DetailsField label="Guardian Name" value={student.guardianName} />
                    <DetailsField label="Relationship" value={student.guardianRelationship} />
                    <DetailsField label="Guardian Contact" value={student.guardianContact} />
                    <DetailsField label="Guardian Email" value={student.guardianEmail} />
                    <DetailsField label="Guardian CNIC" value={student.guardianCnic} />
                  </DetailsSection>
                </div>

                <BlockHeading className="mb-[0.9rem]">Registered Courses</BlockHeading>
                {groups.length === 0 ? (
                  <TableEmpty>This student hasn&apos;t registered for any courses yet.</TableEmpty>
                ) : (
                  groups.map((g) => {
                    const credits = g.courses.reduce((sum, c) => sum + c.creditHours, 0);
                    return (
                      <div key={`${g.semester}-${g.year}`} className="mb-6">
                        <BlockHeading
                          meta={
                            <>
                              {g.semesterNumber && g.semesterNumber >= 1 ? <> · {ordinal(g.semesterNumber)} Semester</> : null}
                              {g.diploma ? <> · {g.diploma.name}</> : null} · {g.courses.length} course{g.courses.length === 1 ? "" : "s"} ·{" "}
                              {credits} CR
                            </>
                          }
                        >
                          {SEMESTER_LABELS[g.semester]} {g.year}
                        </BlockHeading>
                        <TableCard>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Course</TableHead>
                                <TableHead>Section</TableHead>
                                <TableHead>Teacher</TableHead>
                                <TableHead>Credits</TableHead>
                                <TableHead>Grade</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {g.courses.map((c) => (
                                <TableRow key={c.enrollmentId} className="[&>td]:whitespace-normal">
                                  <TableCell>
                                    <NavLink href={`/admin/courses/${c.id}`} className="gap-[0.6rem]">
                                      <span
                                        className="shrink-0 rounded-md px-[0.55rem] py-[0.3rem] text-[0.72rem] font-bold tracking-[0.03em]"
                                        style={{ color: dept?.color, background: dept?.bg }}
                                      >
                                        {c.code}
                                      </span>
                                      <span className="font-semibold text-foreground">{c.name}</span>
                                    </NavLink>
                                  </TableCell>
                                  <TableCell className="!whitespace-nowrap">
                                    <NavLink href={`/admin/sections/${c.section.id}`}>Section {c.section.label}</NavLink>
                                  </TableCell>
                                  <TableCell>
                                    {c.teacher ? (
                                      <>
                                        <div>{c.teacher.name}</div>
                                        <div className={muted}>{c.teacher.email}</div>
                                      </>
                                    ) : (
                                      <span className={muted}>Not assigned</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="!whitespace-nowrap">
                                    <Clock className="inline size-3 align-[-1px]" aria-hidden /> {c.creditHours} CR
                                  </TableCell>
                                  <TableCell>{c.grade ? <strong>{c.grade}</strong> : <span className={muted}>—</span>}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableCard>
                      </div>
                    );
                  })
                )}

                <StudentFees studentId={student.id} />

                {editing ? <ClassicStudentModal student={student} onClose={() => setEditing(false)} /> : null}
              </>
            );
          }}
        </QueryView>
      </div>
    </PageContainer>
  );
}
