/** Clave de localStorage con la elección del botón sol/luna (2.4.0). */
export const THEME_STORAGE_KEY = "theme";

/**
 * Corre en <head> antes del primer pintado (ver `src/app/layout.tsx`): pone
 * `.dark` en <html> según la elección guardada o, si no hay, según el sistema.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.classList.toggle("dark",t==="dark")}catch(e){}})()`;
