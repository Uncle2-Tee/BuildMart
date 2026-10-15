export default function Loading() {
  return (
    <main className="route-loading" role="status" aria-live="polite">
      <span className="route-loading-spinner" aria-hidden="true" />
      <span>Loading page…</span>
    </main>
  );
}
