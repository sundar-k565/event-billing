'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="center">
      <section className="panel">
        <h1>Could not load this screen</h1>
        <p>Your saved bills are kept. Check your connection and retry.</p>
        <button onClick={reset}>Retry</button>
        <a href="/pos">Return to POS</a>
      </section>
    </main>
  );
}
