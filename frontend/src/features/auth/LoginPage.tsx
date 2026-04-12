import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router";
import { z } from "zod";

import { ApiError } from "@/api/client";
import { systemIcons } from "@/components/icons/glyphs";
import { AppIcon } from "@/components/icons/system";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/features/auth/authContext";

const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type LoginForm = z.infer<typeof loginSchema>;
type AuthPhase = "idle" | "authenticating" | "success" | "error";

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState("");
  const [authPhase, setAuthPhase] = useState<AuthPhase>("idle");
  const [progress, setProgress] = useState(0);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const from = (location.state as { from?: { pathname?: string } } | null)?.from
    ?.pathname;

  useEffect(() => {
    if (authPhase !== "authenticating") {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 88) {
          return current;
        }
        const nextStep = Math.max(2, (92 - current) * 0.18);
        return Math.min(88, current + nextStep);
      });
    }, 120);

    return () => {
      window.clearInterval(timer);
    };
  }, [authPhase]);

  if (auth.isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(values: LoginForm) {
    setServerError("");
    setProgress(8);
    setAuthPhase("authenticating");
    try {
      await auth.login(values.email, values.password);
      setAuthPhase("success");
      setProgress(100);
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      navigate(from || "/dashboard", { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setServerError(error.payload.detail || "Could not sign in.");
      } else {
        setServerError("Could not sign in.");
      }

      setAuthPhase("error");
      setProgress(100);
      window.setTimeout(() => {
        setAuthPhase("idle");
        setProgress(0);
      }, 720);
    }
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-[#050816] text-text-inverse">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--primary) 20%, transparent), transparent 34%), radial-gradient(circle at 18% 24%, color-mix(in srgb, var(--info) 18%, transparent), transparent 30%), radial-gradient(circle at 80% 18%, color-mix(in srgb, var(--secondary) 14%, transparent), transparent 28%), linear-gradient(180deg, #070b1d 0%, #050816 55%, #040611 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.18) 1px, transparent 1px, transparent 5px)",
        }}
      />

      <div
        aria-hidden="true"
        className="animate-orbital-spin absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-info/20"
      />
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/20"
      />
      <div
        aria-hidden="true"
        className="animate-liquid-float absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--primary) 22%, transparent), transparent 72%)",
        }}
      />

      <div className="relative mx-auto flex min-h-svh w-full max-w-7xl items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
        <section className="hud-panel relative w-full max-w-[34rem] overflow-hidden rounded-xl px-5 py-5 sm:px-7 sm:py-7">
          <span
            aria-hidden="true"
            className="absolute left-4 top-4 h-5 w-5 border-l border-t border-info/55"
          />
          <span
            aria-hidden="true"
            className="absolute right-4 top-4 h-5 w-5 border-r border-t border-info/55"
          />
          <span
            aria-hidden="true"
            className="absolute bottom-4 left-4 h-5 w-5 border-b border-l border-info/55"
          />
          <span
            aria-hidden="true"
            className="absolute bottom-4 right-4 h-5 w-5 border-b border-r border-info/55"
          />

          <div
            className={[
              "relative z-10",
              authPhase === "error" ? "animate-auth-fail" : "",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="icon-orb-hud">
                  <AppIcon className="h-4 w-4" icon={systemIcons.orbit} />
                </span>
                <div>
                  <p className="hud-label">Stero Tech Inc.</p>
                  <p className="mt-2 text-sm font-medium text-white/72">
                    Company OS
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-info/25 bg-white/5 px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-info animate-hud-pulse" />
                <span className="hud-label">Secure link</span>
              </div>
            </div>

            <div className="mt-10">
              <p className="hud-label">Authentication gate</p>
              <h1 className="mt-4 font-syne text-[2.2rem] font-bold leading-tight text-white sm:text-[2.8rem]">
                System Access
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-7 text-white/62">
                Authenticate to continue.
              </p>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <p className="hud-label">
                  {authPhase === "authenticating"
                    ? "Linking session"
                    : authPhase === "success"
                      ? "Access granted"
                      : authPhase === "error"
                        ? "Access denied"
                        : "Awaiting credentials"}
                </p>
                <p className="hud-label text-white/45">{Math.round(progress)}%</p>
              </div>
              <div className="hud-progress-track mt-3">
                <div
                  className="hud-progress-fill"
                  data-state={
                    authPhase === "success"
                      ? "success"
                      : authPhase === "error"
                        ? "error"
                        : "idle"
                  }
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <form className="mt-8" onSubmit={handleSubmit(onSubmit)}>
              <Input
                autoComplete="email"
                error={errors.email?.message}
                label="Operator email"
                leftIcon={<AppIcon className="h-4 w-4" icon={systemIcons.mail} />}
                placeholder="operator@stero.tech"
                type="email"
                variant="hud"
                {...register("email")}
              />

              <Input
                autoComplete="current-password"
                error={errors.password?.message}
                label="Passkey"
                leftIcon={<AppIcon className="h-4 w-4" icon={systemIcons.key} />}
                placeholder="Enter your password"
                type="password"
                variant="hud"
                wrapperClassName="mt-5"
                {...register("password")}
              />

              {serverError ? (
                <p
                  className="animate-fade-in mt-5 flex items-center gap-2 rounded-lg border border-error/35 bg-error/10 px-3 py-3 text-sm text-error"
                  role="alert"
                >
                  <AppIcon className="h-4 w-4" icon={systemIcons.shield} />
                  {serverError}
                </p>
              ) : null}

              <Button
                className="mt-6 w-full"
                disabled={isSubmitting}
                trailingIcon={<AppIcon className="h-4 w-4" icon={systemIcons.arrowRight} />}
                type="submit"
                variant="hud"
              >
                {authPhase === "success"
                  ? "Access granted"
                  : authPhase === "error"
                    ? "Retry authentication"
                    : isSubmitting
                      ? "Authenticating..."
                      : "Authenticate"}
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-info/15 pt-4">
              <p className="hud-label">Tenant scoped</p>
              <div className="flex items-center gap-2 text-white/48">
                <AppIcon className="h-4 w-4 text-info" icon={systemIcons.shield} />
                <span className="hud-label text-white/48">Protected session</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
