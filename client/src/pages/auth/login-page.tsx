import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";

import { loginSchema, type LoginInput } from "@portal/shared/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, apiGet, getApiError } from "@/lib/api";
import { SESSION_QUERY_KEY, useSession } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";

function LoginForm() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(
    async (values) => {
      setError(null);
      try {
        await api.post("/auth/login", values);
      } catch (loginError) {
        const body = getApiError(loginError);
        setError(
          body?.code === "INVALID_CREDENTIALS" || body?.code === "VALIDATION"
            ? "Incorrect email or password."
            : (body?.message ?? "Couldn't sign in. Please try again."),
        );
        return;
      }
      // Fresh session for the new user - nothing cached from before survives.
      queryClient.clear();
      await queryClient.prefetchQuery({
        queryKey: SESSION_QUERY_KEY,
        queryFn: () => apiGet("/auth/session"),
      });
      navigate("/dashboard", { replace: true });
    },
    () => setError("Incorrect email or password."),
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-[1.1rem]" noValidate>
      <div className="flex flex-col gap-[0.35rem]">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          {...register("email")}
        />
      </div>
      <div className="flex flex-col gap-[0.35rem]">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="pr-10"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            aria-controls="password"
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive-border bg-destructive-soft px-3 py-2 text-[0.875rem] text-destructive"
        >
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting} className="mt-1 h-auto w-full py-[0.72rem]">
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  // Signed-in visitors are bounced to the dashboard.
  const session = useSession();
  const config = useQuery({
    queryKey: ["public-config"],
    queryFn: () => apiGet<{ platformName: string }>("/auth/config"),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (config.data?.platformName) {
      document.title = config.data.platformName;
    }
  }, [config.data?.platformName]);

  if (session.data) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen w-full flex-1 bg-background">
      <main className="mx-auto flex w-full max-w-[420px] flex-col justify-center px-4 py-12">
        <div className="flex flex-col items-center">
          {/* The logo artwork has an opaque white background - fine on the
            off-white page, but it needs its own white plate in dark mode. */}
          <img
            src="/brand/eithm-pk.png"
            alt="Elevate Institute of Tourism & Hospitality Management"
            width={1620}
            height={580}
            fetchPriority="high"
            className="h-[60px] w-auto md:h-[76px] dark:rounded-lg dark:bg-white dark:p-1.5"
          />
          <p className="mb-6 mt-2 text-center text-[0.78rem] text-muted-foreground">
            Developing Talent · Shaping Future
          </p>
        </div>
        <div className="rounded-2xl border border-border border-t-4 border-t-gold bg-card px-8 py-9 shadow-lg max-md:px-5 max-md:py-7">
          <h1 className="font-heading text-[1.15rem] font-extrabold text-foreground">Sign in</h1>
          <p className="mb-6 mt-1 text-[0.82rem] text-muted-foreground">
            Sign in to your EITHM account to continue.
          </p>
          <LoginForm />
          {import.meta.env.DEV ? (
            <div className="mt-6 rounded-md border border-dashed border-border bg-muted p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Dev seed accounts</p>
              <p>Admin: faizan.admin@gcr.dev / F@izan4121</p>
              <p>Teacher: daniel.teacher@gcr.dev</p>
              <p>Student: sofia.student@gcr.dev</p>
              <p>Password (teacher/student): Testpass123!</p>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
