import { useCallback } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Goes one step back in the portal's history. When there is no earlier page
 * in this tab (opened from a bookmark, a notification or a new tab), goes to
 * `fallback` instead, so Back never leaves the portal.
 */
export function useGoBack(fallback = "/dashboard") {
  const navigate = useNavigate();
  return useCallback(() => {
    // React Router numbers each history entry it creates; 0 is the first page of this tab.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}

export function BackButton({ fallback, className }: { fallback?: string; className?: string }) {
  const goBack = useGoBack(fallback);
  return (
    <Button variant="outline" size="sm" className={cn("w-fit", className)} onClick={goBack}>
      <ArrowLeft /> Back
    </Button>
  );
}
