import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/Button";

type AppErrorBoundaryProps = {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Application error boundary caught an error", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-card grid min-h-64 place-items-center px-6 py-10">
          <div className="max-w-md text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg border border-error/25 bg-error-light text-error-hover">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-text-primary">
              {this.props.fallbackTitle ?? "Something went wrong"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {this.props.fallbackDescription ??
                "The screen failed to render. Reload the app and try again."}
            </p>
            <div className="mt-5 flex justify-center">
              <Button
                leadingIcon={<RefreshCw className="h-4 w-4" />}
                onClick={this.handleReload}
              >
                Reload
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
