"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/report-error";

/**
 * 3.2.0 · Fase 4: falla del layout raíz. Reemplaza todo el documento, así que
 * no tiene los estilos de la app: va con estilos en línea y sigue el tema del
 * sistema.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          colorScheme: "light dark",
          background: "Canvas",
          color: "CanvasText",
        }}
      >
        <title>Finance OS · Algo salió mal</title>
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Algo salió mal</h1>
          <p style={{ opacity: 0.75, margin: "0 0 20px", lineHeight: 1.5 }}>
            Finance OS no pudo abrir. Tus datos están bien; intenta de nuevo en un momento.
          </p>
          {error.digest ? <p style={{ fontSize: 12, opacity: 0.6 }}>Código: {error.digest}</p> : null}
          <button
            onClick={() => retry()}
            style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid currentColor", background: "transparent", color: "inherit", cursor: "pointer", fontSize: 15 }}
          >
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
