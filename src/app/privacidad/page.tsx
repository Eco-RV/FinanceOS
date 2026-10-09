import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad · Finance OS",
};

export default function PrivacidadPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10 text-sm leading-relaxed">
      <h1 className="text-2xl font-semibold">Política de privacidad</h1>
      <p className="text-muted-foreground">Última actualización: 8 de octubre de 2026</p>

      <p>
        Finance OS es una aplicación personal de finanzas de uso individual. Esta
        política explica qué datos de tu cuenta de Google se usan y para qué.
      </p>

      <h2 className="text-lg font-medium">Qué datos se acceden</h2>
      <p>
        Si conectas tu Gmail, la app solicita el permiso de solo lectura{" "}
        <code>gmail.readonly</code>. Únicamente se leen los correos enviados por
        los remitentes bancarios que tú registras en Ajustes → Bancos (por
        ejemplo, avisos de compras con tarjeta). No se leen, descargan ni
        procesan los demás correos.
      </p>

      <h2 className="text-lg font-medium">Cómo se usan</h2>
      <p>
        De cada aviso se extraen comercio, fecha, monto, moneda, últimos cuatro
        dígitos de la tarjeta, número de autorización y referencia, para
        proponerte un gasto que tú confirmas. No se usa la información para
        publicidad, no se vende, no se comparte con terceros y no se usa para
        entrenar modelos de inteligencia artificial.
      </p>

      <h2 className="text-lg font-medium">Dónde se guardan</h2>
      <p>
        Los datos extraídos se guardan en tu base de datos de Supabase, protegidos
        por reglas de acceso por usuario. El token de acceso a Gmail se guarda
        cifrado (AES-256-GCM) y solo lo usa el servidor. No se almacena el
        contenido completo de los correos.
      </p>

      <h2 className="text-lg font-medium">Cómo revocar el acceso</h2>
      <p>
        Puedes desconectar tu correo en Ajustes → Bancos (se borra el token) o
        revocar el permiso en{" "}
        <a
          className="underline"
          href="https://myaccount.google.com/permissions"
        >
          myaccount.google.com/permissions
        </a>
        . Puedes borrar tus datos eliminando las compras y bancos desde la app.
      </p>

      <p className="text-muted-foreground">
        Esta aplicación cumple con la Política de datos de usuario de los
        servicios de API de Google, incluidos los requisitos de uso limitado.
      </p>
    </main>
  );
}
