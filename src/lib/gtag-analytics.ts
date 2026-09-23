/** GA4 measurement ID — SSOT for HTML entry points and SSR templates. */
export const GA_MEASUREMENT_ID = "G-HVW22VVK46" as const;

/** Google tag (gtag.js) head snippet for index.html and Worker HTML renders. */
export function renderGtagHeadSnippet(): string {
  return `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA_MEASUREMENT_ID}');
</script>`;
}
