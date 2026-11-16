import { useState } from "react";
import { useLocation } from "react-router";
import { SlidersHorizontal, UserRound } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { ListSkeleton } from "@/components/states/skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Link from "@/components/ui/link";
import { UserRole } from "@portal/shared/enums";
import { ChangePasswordDialog } from "@/features/account/components/change-password-dialog";
import { useSystemSettings } from "@/features/admin/settings/api";
import { SettingsForm } from "@/features/admin/settings/components/settings-form";
import { QueryView } from "@/app/route-states";
import { useSession } from "@/lib/auth";

/** Admins: platform-wide configuration in a popup, loaded only when it's opened. */
function PlatformSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const platformSettings = useSystemSettings(open);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Platform settings</DialogTitle>
          <DialogDescription>Platform-wide configuration. Changes apply as soon as you save.</DialogDescription>
        </DialogHeader>
        <QueryView query={platformSettings} loading={<ListSkeleton rows={4} />}>
          {(settings) => <SettingsForm settings={settings} onSaved={() => onOpenChange(false)} />}
        </QueryView>
      </DialogContent>
    </Dialog>
  );
}

export default function SettingsPage() {
  const isAdmin = useSession().data?.user.role === UserRole.ADMIN;
  // /settings#platform (the old /admin/settings) opens the platform settings straight away.
  const { hash } = useLocation();
  const [platformOpen, setPlatformOpen] = useState(hash === "#platform");

  return (
    <PageContainer className="max-w-2xl">
      <SectionHeader
        title="Settings"
        description={isAdmin ? "Account security and platform-wide configuration." : "Account security."}
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

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Platform settings</CardTitle>
            <CardDescription>
              Platform name, sessions and uploads, password policy, default classroom settings and notifications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setPlatformOpen(true)}>
              <SlidersHorizontal /> Open platform settings
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Looking for your name, email, role, or profile photo?{" "}
        <Link href="/profile" className="link-pill text-primary">
          <UserRound className="h-3.5 w-3.5" aria-hidden />
          Go to your profile
        </Link>
      </p>

      {isAdmin ? <PlatformSettingsDialog open={platformOpen} onOpenChange={setPlatformOpen} /> : null}
    </PageContainer>
  );
}
