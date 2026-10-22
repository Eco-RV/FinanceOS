import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Términos de uso · Finance OS",
};

/**
 * 3.2.0 · Fase 4: términos para el acceso anticipado (early birds).
 * Borrador: revisar con una persona antes de anunciar la app.
 */
export default function TerminosPage() {
  return (
    <LegalPage title="Términos de uso" updated="21 de octubre de 2026">
      <p>
        Al crear una cuenta o usar Finance OS aceptas estos términos. Si no estás de acuerdo, no uses la app.
      </p>

      <h2>Qué es Finance OS</h2>
      <p>
        Una herramienta para ordenar tus finanzas personales: te ayuda a saber cuánto pagar de cada tarjeta, para
        cuándo y si tu cuenta alcanza, entre otras funciones que puedes activar. Está en <strong>acceso
        anticipado</strong>: puede cambiar, tener errores o dejar de ofrecer alguna función.
      </p>

      <h2>No es asesoría financiera</h2>
      <p>
        Los cálculos de la app (montos de contado, fechas, coberturas, intereses) se basan en los datos que tú
        registras y son una ayuda, no una garantía. Antes de pagar o decidir, confirma los montos y fechas con el
        estado de cuenta de tu banco. Finance OS no es un banco ni un asesor financiero y no mueve tu dinero.
      </p>

      <h2>Tu cuenta</h2>
      <ul>
        <li>La cuenta es personal. Cuida tu contraseña; lo que se haga con tu sesión es tu responsabilidad.</li>
        <li>Los datos que registras deben ser tuyos o tener permiso para registrarlos (por ejemplo, de las personas con las que compartes gastos).</li>
        <li>Puedes borrar tu cuenta y todos tus datos cuando quieras desde Ajustes → Mi cuenta.</li>
      </ul>

      <h2>Uso aceptable</h2>
      <p>
        No intentes acceder a datos de otras personas, afectar el funcionamiento de la app ni usarla para algo ilegal.
        Podemos suspender una cuenta que lo haga.
      </p>

      <h2>Tus datos</h2>
      <p>
        Tus datos son tuyos. Cómo los tratamos está en la{" "}
        <Link href="/privacidad" className="underline">
          Política de privacidad
        </Link>
        .
      </p>

      <h2>Disponibilidad y responsabilidad</h2>
      <p>
        Hacemos lo posible para que la app funcione y tus datos estén respaldados, pero se ofrece &quot;tal cual&quot;,
        sin garantía de que esté siempre disponible o libre de errores. En la medida que lo permita la ley, Finance OS
        no responde por pérdidas que resulten de decisiones tomadas con base en sus cálculos.
      </p>

      <h2>Cambios</h2>
      <p>
        Si cambiamos estos términos, actualizamos la fecha de arriba y, si el cambio es importante, te avisamos en la
        app. Seguir usándola significa que aceptas la versión nueva.
      </p>

      <h2>Ley aplicable y contacto</h2>
      <p>
        Estos términos se rigen por las leyes de la República de Costa Rica. Para cualquier duda o reclamo,
        escríbenos desde <strong>Comentarios</strong> en la app.
      </p>
    </LegalPage>
  );
}
