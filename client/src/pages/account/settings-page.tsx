import { useEffect } from "react";
import { useLocation } from "react-router";
import { UserRound } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { ListSkeleton } from "@/components/states/skeletons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "@/components/ui/link";
import { UserRole } from "@portal/shared/enums";
import { ChangePasswordDialog } from "@/features/account/components/change-password-dialog";
import { useSystemSettings } from "@/features/admin/settings/api";
import { SettingsForm } from "@/features/admin/settings/components/settings-form";
import { QueryView } from "@/app/route-states";
import { useSession } from "@/lib/auth";

export default function SettingsPage() {
  const isAdmin = useSession().data?.user.role === UserRole.ADMIN;
  const platformSettings = useSystemSettings(isAdmin);
  const { hash } = useLocation();

  // /settings#platform (the old /admin/settings) scrolls to the platform section.
  useEffect(() => {
    if (hash && platformSettings.data) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
    }
  }, [hash, platformSettings.data]);

  return (
    <PageContainer className={isAdmin ? "max-w-3xl" : "max-w-2xl"}>
      <SectionHeader
        title="Settings"
        description={
          isAdmin ? "Account security and platform-wide configuration." : "Account security."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Update the password you use to sign in.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordDialog />
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Looking for your name, email, role, or profile photo?{" "}
        <Link href="/profile" className="link-pill text-primary">
          <UserRound className="h-3.5 w-3.5" aria-hidden />
          Go to your profile
        </Link>
      </p>

      {isAdmin ? (
        <QueryView query={platformSettings} loading={<ListSkeleton rows={4} />}>
          {(settings) => (
            <section id="platform" className="flex scroll-mt-20 flex-col gap-6">
              <SectionHeader
                title="Platform settings"
                description="Platform-wide configuration. Changes apply immediately."
              />
              <SettingsForm settings={settings} />
            </section>
          )}
        </QueryView>
      ) : null}
    </PageContainer>
  );
}
