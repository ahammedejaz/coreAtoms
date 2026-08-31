/**
 * SEO.jsx — Reusable SEO head tags component.
 *
 * Sets `<title>`, `<meta name="description">`, `<link rel="canonical">`,
 * Open Graph, and Twitter Card meta tags.
 *
 * React 19 hoists `<title>`, `<meta>` and `<link>` into `<head>` from anywhere
 * in the tree, so these are plain elements — no Helmet provider is involved.
 *
 * Absolute URLs are resolved against the *runtime* origin: the production
 * domain is not recorded anywhere in this repo, so `window.location.origin` is
 * the only base URL we can state truthfully.
 *
 * @module components/SEO
 *
 * @example
 *   <SEO
 *     title="Shop | Core Atoms"
 *     description="Browse premium nutraceuticals…"
 *     canonical="/shop"
 *     ogImage="/og-shop.jpg"
 *   />
 */
const SITE_NAME = "Core Atoms";
const DEFAULT_DESCRIPTION =
    "Premium nutraceuticals designed for daily consistency. Clean formulas, structured stacks, COD available across India.";

/** Resolves a path (or already-absolute URL) against the current origin. */
function absoluteUrl(path) {
    if (typeof window === "undefined") return undefined;
    try {
        return new URL(path, window.location.origin).toString();
    } catch {
        return undefined;
    }
}

export default function SEO({
    title = SITE_NAME,
    description = DEFAULT_DESCRIPTION,
    ogImage,
    /** Path (e.g. `/shop`) or absolute URL. Defaults to the current path, which
     *  drops any query string — exactly what a canonical should do. */
    canonical,
    /** Open Graph object type — `"product"` on PDPs, `"website"` elsewhere. */
    type = "website",
    noIndex = false,
}) {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    const canonicalUrl = absoluteUrl(
        canonical || (typeof window !== "undefined" ? window.location.pathname : "/")
    );
    // og:image must be absolute for scrapers; product images already are.
    const ogImageUrl = ogImage ? absoluteUrl(ogImage) : undefined;

    return (
        <>
            <title>{fullTitle}</title>
            <meta name="description" content={description} />
            {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

            {/* Open Graph */}
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:site_name" content={SITE_NAME} />
            <meta property="og:type" content={type} />
            {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
            {ogImageUrl && <meta property="og:image" content={ogImageUrl} />}

            {/* Twitter Card */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
            {ogImageUrl && <meta name="twitter:image" content={ogImageUrl} />}

            {/* Indexing control */}
            {noIndex && <meta name="robots" content="noindex,nofollow" />}
        </>
    );
}
