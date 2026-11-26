export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-16">
      <div className="h-4 w-28 animate-pulse rounded-full bg-canvas-deep" />
      <div className="mt-4 h-10 w-72 animate-pulse rounded-full bg-canvas-deep" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-80 animate-pulse rounded-3xl bg-canvas-deep" />
        ))}
      </div>
    </main>
  );
}
