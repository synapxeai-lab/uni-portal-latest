import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/page/back-button";
import { PageContainer } from "@/components/page/page-container";
import { ChangePasswordForm } from "@/features/account/components/change-password-form";
import { useSession } from "@/lib/auth";

export default function ChangePasswordPage() {
  const session = useSession();
  const forced = Boolean(session.data?.mustChangePassword);

  return (
    <PageContainer className="max-w-md">
      {/* A forced change has nowhere to go back to: every other page sends you here. */}
      {forced ? null : <BackButton fallback="/settings" />}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Change password</CardTitle>
          <CardDescription>Choose a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm forced={forced} />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
