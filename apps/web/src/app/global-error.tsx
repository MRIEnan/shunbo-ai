"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Figtree, Arial, sans-serif", background: "#ffffeb", color: "#1a1a1a", margin: 0 }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <h1 style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 36, fontWeight: 400, margin: 0 }}>Something went wrong.</h1>
            <p style={{ color: "#555", fontSize: 14 }}>The app failed to load. {error.digest ? `Ref ${error.digest}.` : ""}</p>
            <button
              type="button"
              onClick={reset}
              style={{ marginTop: 16, height: 40, padding: "0 18px", borderRadius: 999, border: "1px solid #1a1a1a", background: "#f0d7ff", cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
