import { Navigate } from "react-router";

import { useCurrentClassroom } from "@/pages/classes/classroom-layout";

/**
 * /classes/:id/marks and /classes/:id/attendance moved to the sidebar's Marks
 * and Attendance pages. Old links (bookmarks, notifications) land there:
 * teachers and admins on that course section, students on their own page.
 */
export default function ClassroomOfferingRedirect({ to }: { to: "marks" | "attendance" }) {
  const classroom = useCurrentClassroom();
  if (!classroom.offering) {
    return <Navigate to={`/classes/${classroom.id}/stream`} replace />;
  }
  if (classroom.role === "STUDENT") {
    return <Navigate to={to === "marks" ? "/my-marks" : "/my-attendance"} replace />;
  }
  const { sectionId, courseId } = classroom.offering;
  return <Navigate to={`/${to}/${sectionId}/${courseId}`} replace />;
}
