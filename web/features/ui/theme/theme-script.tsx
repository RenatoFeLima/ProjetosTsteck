/**
 * ThemeScript — Server Component
 *
 * Injects a small synchronous inline script that runs before any React
 * hydration. This prevents a flash of the wrong theme (FOUC) on first load
 * by reading localStorage and applying the `dark` class to <html> immediately.
 */
export function ThemeScript() {
  const script = `(function(){try{var t=localStorage.getItem('tsteck-theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: intentional — no user input involved
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  );
}
