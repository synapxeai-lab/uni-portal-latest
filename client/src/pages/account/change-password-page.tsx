import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/page/page-container";
import { ChangePasswordForm } from "@/features/account/components/change-password-form";
import { useSession } from "@/lib/auth";

export default function ChangePasswordPage() {
  const session = useSession();

  return (
    <PageContainer className="max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Change password</CardTitle>
          <CardDescription>Choose a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm forced={Boolean(session.data?.mustChangePassword)} />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
