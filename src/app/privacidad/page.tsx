import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Política de privacidad · Finance OS",
};

/**
 * 3.2.0 · Fase 4: reescrita para varios usuarios (antes decía "de uso
 * individual"). Conserva la sección de Google (requisito de la verificación
 * de los permisos de Gmail). Borrador: revisar con una persona antes de
 * anunciar la app.
 */
export default function PrivacidadPage() {
  return (
    <LegalPage title="Política de privacidad" updated="21 de octubre de 2026">
      <p>
        Finance OS es una aplicación para ordenar tus finanzas personales: tarjetas, cuentas, gastos y lo que actives.
        Esta política explica qué datos guarda, para qué y qué control tienes sobre ellos. Se rige por la Ley 8968 de
        Protección de la Persona frente al Tratamiento de sus Datos Personales de Costa Rica.
      </p>

      <h2>Qué datos guardamos</h2>
      <ul>
        <li>
          <strong>Tu cuenta:</strong> correo, nombre, usuario, país y foto si los pones. La contraseña la maneja el
          servicio de autenticación y nunca la vemos.
        </li>
        <li>
          <strong>Lo que registras:</strong> cuentas, tarjetas (nombre, banco, últimos cuatro dígitos si los pones,
          días de corte y pago, límite), movimientos, planes, metas, préstamos, financiamientos, personas con las que
          compartes gastos y los comprobantes o capturas que subes. No pedimos ni guardamos números completos de
          tarjeta ni claves de tu banco.
        </li>
        <li>
          <strong>Lo que escribes en Comentarios:</strong> tus publicaciones y mensajes con el equipo, con tu nombre.
        </li>
        <li>
          <strong>Preferencias:</strong> formato de fecha, moneda base, tema y qué funciones tienes activas.
        </li>
      </ul>

      <h2>Para qué los usamos</h2>
      <p>
        Solo para darte el servicio: calcular cuánto pagar de cada tarjeta y para cuándo, si tu cuenta alcanza, tus
        gastos y lo demás que actives, y responderte en Comentarios. No vendemos tus datos, no los usamos para
        publicidad, no los compartimos con terceros para sus fines y no los usamos para entrenar modelos de
        inteligencia artificial.
      </p>

      <h2>Quién más los procesa</h2>
      <p>Para funcionar, la app usa estos servicios, que procesan datos solo por encargo nuestro:</p>
      <ul>
        <li>
          <strong>Supabase:</strong> base de datos, archivos y autenticación. Cada fila lleva reglas de acceso por
          usuario: nadie más que tú ve tus datos.
        </li>
        <li>
          <strong>Vercel:</strong> aloja la aplicación.
        </li>
        <li>
          <strong>Sentry</strong> (si está activo): recibe los errores de la app para corregirlos, sin tus datos ni los
          del request.
        </li>
        <li>
          <strong>Google:</strong> solo si entras con Google o conectas tu Gmail (ver abajo).
        </li>
      </ul>
      <p>
        El tipo de cambio se consulta a la API pública del Ministerio de Hacienda; esa consulta no lleva ningún dato
        tuyo.
      </p>

      <h2>Quién puede ver tus datos</h2>
      <p>
        Solo tú. La única excepción es lo que escribes en <strong>Comentarios</strong>, que también lo lee el equipo
        de Finance OS para responderte.
      </p>

      <h2>Cookies y almacenamiento del navegador</h2>
      <p>
        Usamos cookies necesarias para mantener tu sesión y recordar el formato de fecha y la sincronización del día.
        El navegador guarda tu tema, si ya viste la bienvenida y los últimos valores de un gasto, para ahorrarte
        pasos. No usamos cookies de publicidad ni de rastreo.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes ver y corregir tus datos desde la app en cualquier momento. Puedes borrar tu cuenta en{" "}
        <strong>Ajustes → Mi cuenta</strong>: se borran tu usuario y todos tus datos, incluidos fotos, comprobantes y
        lo que escribiste en Comentarios. Para cualquier otra solicitud de acceso, rectificación o supresión,
        escríbenos desde <strong>Comentarios</strong>.
      </p>

      <h2>Tu cuenta de Google</h2>
      <p>
        Si conectas tu Gmail, la app solicita el permiso de solo lectura <code>gmail.readonly</code>. Únicamente se
        leen los correos enviados por los remitentes bancarios que tú registras en Ajustes → Bancos (por ejemplo,
        avisos de compras con tarjeta). No se leen, descargan ni procesan los demás correos. También solicita{" "}
        <code>gmail.send</code>, solo para enviar desde tu cuenta, cuando tú lo pides, el aviso de lo que le toca
        pagar a una persona con la que compartes un gasto o un financiamiento. La app no lee ni modifica los correos
        que envías.
      </p>
      <p>
        De cada aviso se extraen comercio, fecha, monto, moneda, últimos cuatro dígitos de la tarjeta, número de
        autorización y referencia, para proponerte un gasto que tú confirmas. No se guarda el contenido completo de
        los correos. El token de acceso a Gmail se guarda cifrado (AES-256-GCM) y solo lo usa el servidor.
      </p>
      <p>
        Puedes desconectar tu correo en Ajustes → Bancos (se borra el token) o revocar el permiso en{" "}
        <a className="underline" href="https://myaccount.google.com/permissions">
          myaccount.google.com/permissions
        </a>
        .
      </p>
      <p className="text-muted-foreground">
        El uso de la información recibida de las API de Google cumple con la Política de datos de usuario de los
        servicios de API de Google, incluidos los requisitos de uso limitado.
      </p>

      <h2>Cambios</h2>
      <p>
        Si esta política cambia, actualizamos la fecha de arriba y, si el cambio es importante, te avisamos en la app.
      </p>
    </LegalPage>
  );
}
