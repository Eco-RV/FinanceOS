import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 2.6.0: la foto de perfil viaja en una Server Action (ya recortada a
    // 512 px en el navegador; el dominio la limita a 2 MB).
    serverActions: { bodySizeLimit: "3mb" },
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
