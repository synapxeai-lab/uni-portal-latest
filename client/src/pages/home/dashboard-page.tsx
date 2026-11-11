import { PageContainer } from "@/components/page/page-container";
import { useDashboard } from "@/features/dashboard/api";
import { AdminDashboardView } from "@/features/dashboard/components/admin-dashboard-view";
import { StudentDashboardView } from "@/features/dashboard/components/student-dashboard-view";
import { TeacherDashboardView } from "@/features/dashboard/components/teacher-dashboard-view";
import { WelcomeCard } from "@/features/dashboard/components/welcome-card";
import { AppLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { useSession } from "@/lib/auth";

/** Home is the only dashboard for every role - admins get the platform-wide view here. */
export default function DashboardPage() {
  const name = useSession().data?.user.name;
  const dashboard = useDashboard();

  return (
    <QueryView query={dashboard} loading={<AppLoading />}>
      {(response) => {
        if (response.role === "ADMIN") {
          return (
            <PageContainer>
              <WelcomeCard
                name={name}
                description="You have full administrative access. Manage users, classrooms, and monitor platform-wide activity from here."
              />
              <AdminDashboardView data={response.data} />
            </PageContainer>
          );
        }
        if (response.role === "TEACHER") {
          return (
            <PageContainer>
              <WelcomeCard
                name={name}
                description="Your classes, review queue, and scheduled content at a glance."
              />
              <TeacherDashboardView data={response.data} />
            </PageContainer>
          );
        }
        return (
          <PageContainer>
            <WelcomeCard
              name={name}
              description="Your classes, upcoming deadlines, and archived classes at a glance."
            />
            <StudentDashboardView data={response.data} classrooms={response.classrooms} />
          </PageContainer>
        );
      }}
    </QueryView>
  );
}
