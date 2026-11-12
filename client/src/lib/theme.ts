/*
 * Light / dark / system theme preference.
 *
 * The choice lives in localStorage (no account round-trip) and is applied as
 * <html data-theme="light|dark">, which globals.css and Tailwind's `dark:`
 * variant key off. "system" resolves to whatever the OS prefers. With no saved
 * choice the portal is light, whatever the OS prefers.
 */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
export const DEFAULT_THEME: ThemePreference = "light";
// Fired on window when the preference changes in this tab (localStorage's own
// "storage" event only reaches other tabs).
export const THEME_CHANGE_EVENT = "themechange";

export const THEME_PREFERENCES: ThemePreference[] = ["light", "dark", "system"];

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/*
 * Runs synchronously in <head> before first paint, so the page never flashes
 * the wrong theme. It also keeps following the OS while the preference is
 * "system" - the listener lives for the whole session since client-side
 * navigations never reload the document.
 */
export const themeInitScript = `(function(){var k=${JSON.stringify(THEME_STORAGE_KEY)},d=document.documentElement,m=window.matchMedia("(prefers-color-scheme: dark)");function p(){try{var t=localStorage.getItem(k);return t==="light"||t==="dark"||t==="system"?t:"light"}catch(e){return "light"}}function a(){var t=p();d.setAttribute("data-theme",t==="system"?(m.matches?"dark":"light"):t)}a();m.addEventListener("change",a)})()`;
