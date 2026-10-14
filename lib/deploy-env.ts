// Vercel "Preview" deployments share the production environment variables (database, e-mail key, Meta token). So a preview must
// never talk to Meta's Conversions API, and the Romanian order route stays closed on it unless explicitly opened.
export const isPreviewDeploy = (): boolean => process.env.VERCEL_ENV === "preview";

/** Orders from the Romanian preview are opt-in (RO_PREVIEW_ORDERS=1 on the Preview environment): they would use the live database. */
export const previewOrdersAllowed = (): boolean => !isPreviewDeploy() || process.env.RO_PREVIEW_ORDERS === "1";
