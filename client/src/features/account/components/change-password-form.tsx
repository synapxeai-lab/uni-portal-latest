import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { ChangePasswordInput } from "@portal/shared/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/lib/navigation";
import { SESSION_QUERY_KEY } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";

import { changePassword } from "../api";

type ChangePasswordFormProps = {
  forced: boolean;
  /** Called after a successful change instead of redirecting to the dashboard. */
  onSuccess?: () => void;
};

type FormValues = Omit<ChangePasswordInput, "forced">;
type FieldName = keyof FormValues;

export function ChangePasswordForm({ forced, onSuccess }: ChangePasswordFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    // Policy and match checks run on the server (the policy is admin-configurable).
    const result = await changePassword(values);

    if (result.status === "error") {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          if (messages?.[0]) {
            setError(field as FieldName, { message: messages[0] });
          }
        }
      } else {
        toast.error(result.message);
      }
      return;
    }

    toast.success("Password updated.");
    // The session no longer carries a pending forced change.
    await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    if (onSuccess) {
      onSuccess();
      return;
    }
    router.replace("/dashboard");
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {forced ? (
        <p className="text-sm text-muted-foreground">
          An administrator requires you to set a new password before continuing.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currentPassword">Current password</Label>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            {...register("currentPassword")}
          />
          {errors.currentPassword?.message ? (
            <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
          ) : null}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          required
          autoFocus={forced}
          {...register("newPassword")}
        />
        {errors.newPassword?.message ? (
          <p className="text-xs text-destructive">{errors.newPassword.message}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          {...register("confirmPassword")}
        />
        {errors.confirmPassword?.message ? (
          <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
        ) : null}
      </div>
      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
