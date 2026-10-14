// Vercel "Preview" deployments share the production environment variables (database, e-mail key, Meta token). So a preview must
// never talk to Meta's Conversions API, and the Romanian order route stays closed on it unless explicitly opened.
export const isPreviewDeploy = (): boolean => process.env.VERCEL_ENV === "preview";

/** Orders from a preview are opt-in (PREVIEW_ORDERS=1, or the older RO_PREVIEW_ORDERS=1, on the Preview environment only): they would use the live database. */
export const previewOrdersAllowed = (): boolean => !isPreviewDeploy() || process.env.PREVIEW_ORDERS === "1" || process.env.RO_PREVIEW_ORDERS === "1";

/** Orders placed on a preview are marked in their notes, so they are recognisable as tests in the live panel and e-mails. */
export const previewMarked = (notes: string): string | null =>
  isPreviewDeploy() ? `[TEST preview] ${notes}`.trim() : notes || null;
