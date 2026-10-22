import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 2.6.0: la foto de perfil viaja en una Server Action (ya recortada a
    // 512 px en el navegador; el dominio la limita a 2 MB).
    // 3.1.0: comprobantes de hasta 5 MB (G8).
    serverActions: { bodySizeLimit: "6mb" },
  },
  // 3.2.0 · Fase 4: cabeceras de seguridad en todas las respuestas. La CSP
  // completa queda para después (Cavos y Stellar cargan scripts de terceros);
  // por ahora solo `frame-ancestors`: nadie puede meter la app en un iframe.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Lo que la app no usa queda bloqueado (USB/HID quedan libres para wallets de hardware).
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Paso 2: las rutas de módulos viven bajo /procesos.
      { source: "/cuentas", destination: "/procesos/cuentas", permanent: true },
      { source: "/tarjetas", destination: "/procesos/tarjetas", permanent: true },
    ];
  },
};

export default nextConfig;
