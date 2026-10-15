import { AppBackdrop } from "@/components/app-backdrop";
import { LogoMark } from "@/components/brand-logo";
import { LoginForm } from "./login-form";

const POINTS = [
  "Cortes y pagos de contado de cada tarjeta",
  "Financiamientos, préstamos y cobros a la familia",
  "Liquidez y gastos del mes de un vistazo",
];

export default function LoginPage() {
  return (
    <div className="relative flex flex-1 items-stretch">
      <AppBackdrop />

      {/* 2.5.0: en pantallas grandes, panel de marca a la izquierda. */}
      <aside className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <LogoMark className="size-7" />
          <span className="text-lg font-semibold tracking-tight">
            Finance<span className="opacity-60"> OS</span>
          </span>
        </div>
        <div className="flex max-w-md flex-col gap-6">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight">
            Tus finanzas personales, en orden y a tiempo.
          </h2>
          <ul className="flex flex-col gap-3 text-sm opacity-80">
            {POINTS.map((p, i) => (
              <li
                key={p}
                className="rise flex items-center gap-3"
                style={{ ["--rise-i" as string]: i + 2 }}
              >
                <span className="size-2 rounded-[3px] bg-primary-foreground/70" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <LogoMark
          className="pointer-events-none absolute -right-16 -bottom-16 size-80 opacity-[0.07]"
          animated
        />
        <p className="text-xs opacity-50">Un solo usuario · tus datos en tu Supabase</p>
      </aside>

      <div className="flex flex-1 items-center justify-center p-6">
        <LoginForm />
      </div>
    </div>
  );
}
