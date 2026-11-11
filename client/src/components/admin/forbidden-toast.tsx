import { useEffect } from "react";
import { useRouter, useSearchParams } from "@/lib/navigation";
import { toast } from "sonner";

export function ForbiddenToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const denied = searchParams.get("denied");

  useEffect(() => {
    if (denied !== "admin" && denied !== "review") {
      return;
    }

    toast.error(
      denied === "admin"
        ? "You don't have permission to access the admin area."
        : "The review queue is only available to teachers.",
    );

    const params = new URLSearchParams(searchParams);
    params.delete("denied");
    router.replace(params.size > 0 ? `/dashboard?${params.toString()}` : "/dashboard", {
      scroll: false,
    });
  }, [denied, router, searchParams]);

  return null;
}
