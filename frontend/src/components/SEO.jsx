/**
 * SEO.jsx — Reusable SEO head tags component.
 *
 * Sets `<title>`, `<meta name="description">`, Open Graph,
 * and Twitter Card meta tags.
 *
 * React 19 hoists `<title>` and `<meta>` into `<head>` from anywhere in the
 * tree, so these are plain elements — no Helmet provider is involved.
 *
 * @module components/SEO
 *
 * @example
 *   <SEO
 *     title="Shop | Core Atoms"
 *     description="Browse premium nutraceuticals…"
 *     ogImage="/og-shop.jpg"
 *   />
 */
const SITE_NAME = "Core Atoms";
const DEFAULT_DESCRIPTION =
    "Premium nutraceuticals designed for daily consistency. Clean formulas, structured stacks, COD available across India.";

export default function SEO({
    title = SITE_NAME,
    description = DEFAULT_DESCRIPTION,
    ogImage,
    noIndex = false,
}) {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;

    return (
        <>
            <title>{fullTitle}</title>
            <meta name="description" content={description} />

            {/* Open Graph */}
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:site_name" content={SITE_NAME} />
            <meta property="og:type" content="website" />
            {ogImage && <meta property="og:image" content={ogImage} />}

            {/* Twitter Card */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
            {ogImage && <meta name="twitter:image" content={ogImage} />}

            {/* Indexing control */}
            {noIndex && <meta name="robots" content="noindex,nofollow" />}
        </>
    );
}
