import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router";

import { Button } from "@/components/ui/Button";

export function RouteErrorPage() {
  const navigate = useNavigate();
  const error = useRouteError();

  let title = "Page failed to load";
  let description = "The route could not be rendered. Refresh the page and try again.";

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    description =
      typeof error.data === "string"
        ? error.data
        : "The requested page returned an error response.";
  } else if (error instanceof Error) {
    description = error.message;
  }

  return (
    <section className="grid min-h-[60svh] place-items-center px-4 py-10">
      <div className="app-card max-w-lg px-6 py-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg border border-error/25 bg-error-light text-error-hover">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-text-primary">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            leadingIcon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate(-1)}
            variant="secondary"
          >
            Go Back
          </Button>
          <Button
            leadingIcon={<RefreshCw className="h-4 w-4" />}
            onClick={() => window.location.reload()}
          >
            Reload
          </Button>
        </div>
      </div>
    </section>
  );
}
