import { useEffect } from "react";
import { useRouter, useSearchParams } from "@/lib/navigation";
import { toast } from "sonner";

/** Why a role-restricted page sent the user back to the dashboard (?denied=...). */
const DENIED_MESSAGES: Record<string, string> = {
  admin: "You don't have permission to access the admin area.",
  review: "The review queue is only available to teachers.",
  student: "That page is only available to students.",
  teacher: "That page is only available to teachers.",
};

export function ForbiddenToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const denied = searchParams.get("denied");

  useEffect(() => {
    const message = denied ? DENIED_MESSAGES[denied] : undefined;
    if (!message) {
      return;
    }

    toast.error(message);

    const params = new URLSearchParams(searchParams);
    params.delete("denied");
    router.replace(params.size > 0 ? `/dashboard?${params.toString()}` : "/dashboard", {
      scroll: false,
    });
  }, [denied, router, searchParams]);

  return null;
}
