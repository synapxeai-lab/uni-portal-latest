import { HeaderBar } from "@/components/shell/header";
import type { NavSection } from "@/components/shell/nav-config";
import type { ShellUser } from "@/components/shell/user-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";

export function AdminHeader({ user, sections }: { user: ShellUser; sections: NavSection[] }) {
  return (
    <HeaderBar
      user={user}
      sections={sections}
      fallbackTitle="Admin Dashboard"
      titleAdornment={
        <Badge variant="gold" className="hidden uppercase tracking-[0.06em] sm:inline-flex">
          Administrator
        </Badge>
      }
      actions={<ThemeToggle />}
    />
  );
}
