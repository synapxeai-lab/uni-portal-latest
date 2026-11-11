import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useProfile } from "@/features/account/api";
import { AvatarUploadForm } from "@/features/account/components/avatar-upload-form";
import { AppLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
};

function formatMemberSince(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function ProfilePage() {
  const profile = useProfile();

  return (
    <QueryView query={profile} loading={<AppLoading />}>
      {(user) => (
        <PageContainer className="max-w-2xl">
          <SectionHeader
            title="Profile"
            description="Your account as set up by your administrator."
          />

          <Card>
            <CardHeader>
              <CardTitle>Photo</CardTitle>
              <CardDescription>Shown next to your name across the platform.</CardDescription>
            </CardHeader>
            <CardContent>
              <AvatarUploadForm name={user.name} email={user.email} avatarUrl={user.avatarUrl} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account details</CardTitle>
              <CardDescription>
                Assigned by an administrator when your account was created - contact them if your
                name or email need to change.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Name
                </span>
                <span className="text-sm text-foreground">{user.name}</span>
              </div>
              <Separator />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email
                </span>
                <span className="text-sm text-foreground">{user.email}</span>
              </div>
              <Separator />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Role
                </span>
                <Badge variant="outline" className="w-fit">
                  {ROLE_LABEL[user.role] ?? user.role}
                </Badge>
              </div>
              <Separator />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Member since
                </span>
                <span className="text-sm text-foreground">{formatMemberSince(user.createdAt)}</span>
              </div>
            </CardContent>
          </Card>
        </PageContainer>
      )}
    </QueryView>
  );
}
