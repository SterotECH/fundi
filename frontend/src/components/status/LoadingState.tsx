export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="app-card grid min-h-40 place-items-center px-6 py-10 text-sm text-text-secondary">
      {label}
    </div>
  );
}
