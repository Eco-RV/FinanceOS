import type { FormEvent } from "react";

/**
 * 3.2.0 · Fase 5: envía un formulario sin que React borre lo escrito.
 *
 * Con `<form action={fn}>`, React 19 limpia los campos al terminar la acción,
 * aunque la acción haya devuelto un error de validación: el usuario perdía
 * todo lo que escribió. Con `onSubmit={keepOnError(fn)}` el formulario queda
 * como estaba; si sale bien, el diálogo se cierra igual que antes.
 */
export function keepOnError(submit: (formData: FormData) => unknown) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    submit(new FormData(event.currentTarget, submitter));
  };
}
