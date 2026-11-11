import { Toaster } from "sonner";

import { useTheme } from "@/hooks/use-theme";

// Sonner only knows the OS preference on its own; feed it the in-app choice.
export function AppToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      theme={resolvedTheme}
      position="bottom-right"
      closeButton
      duration={3500}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-xl !border !px-[1.1rem] !py-3 !font-sans !text-[0.87rem] !font-semibold !shadow-[0_4px_16px_rgb(0_0_0/0.12)] sm:!max-w-[340px]",
          success: "!border-success-border !bg-success-soft !text-success",
          error: "!border-destructive-border !bg-destructive-soft !text-destructive",
          warning: "!border-warning-border !bg-warning-soft !text-warning",
          info: "!border-info-border !bg-info-soft !text-info",
        },
      }}
    />
  );
}
