import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Paso 2: las rutas de módulos viven bajo /procesos.
      { source: "/cuentas", destination: "/procesos/cuentas", permanent: true },
      { source: "/tarjetas", destination: "/procesos/tarjetas", permanent: true },
    ];
  },
};

export default nextConfig;
