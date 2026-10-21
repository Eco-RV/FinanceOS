/** Clave de localStorage con la elección del botón sol/luna (2.4.0). */
export const THEME_STORAGE_KEY = "theme";

/** 3.2.0: la bienvenida ya se vio en este dispositivo (ver `WelcomeSplash`). */
export const WELCOME_STORAGE_KEY = "fo-welcome";

/**
 * Corre en <head> antes del primer pintado (ver `src/app/layout.tsx`): pone
 * `.dark` en <html> según la elección guardada o, si no hay, según el
 * sistema. 3.2.0: si la bienvenida ya se vio, marca `data-welcomed` para que
 * no tape la app (CSS en `globals.css`).
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.classList.toggle("dark",t==="dark");if(localStorage.getItem("${WELCOME_STORAGE_KEY}")==="1")document.documentElement.setAttribute("data-welcomed","")}catch(e){}})()`;
