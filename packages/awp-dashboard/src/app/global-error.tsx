"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#06090f",
          color: "#e2e8f0",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 400, padding: "0 1rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: "0.875rem", color: "#7b8da4", marginBottom: 4 }}>
            {error.message || "A critical error occurred."}
          </p>
          {error.digest && (
            <p style={{ fontSize: "0.75rem", color: "#3d4f63", fontFamily: "monospace" }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              fontSize: "0.875rem",
              fontWeight: 500,
              borderRadius: 8,
              border: "1px solid #1e2d3d",
              background: "#151b25",
              color: "#e2e8f0",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
