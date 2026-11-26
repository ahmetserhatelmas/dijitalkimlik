export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-16">
      <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr]">
        <div className="min-h-80 animate-pulse rounded-3xl bg-canvas-deep" />
        <div>
          <div className="h-4 w-24 animate-pulse rounded-full bg-canvas-deep" />
          <div className="mt-4 h-12 w-64 animate-pulse rounded-full bg-canvas-deep" />
          <div className="mt-8 h-10 w-40 animate-pulse rounded-full bg-canvas-deep" />
          <div className="mt-8 h-40 animate-pulse rounded-2xl bg-canvas-deep" />
        </div>
      </div>
    </main>
  );
}
