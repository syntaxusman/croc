// White-label branding is compiled in from VITE_BRAND_NAME (see
// vite.config.ts). Because the values are build-time constants, a branded
// build drops the upstream croc content, links, and blog from the bundle
// entirely. An empty value keeps the upstream croc site unchanged.
const configuredBrand: string = import.meta.env.VITE_BRAND_NAME;

export const isWhiteLabel = configuredBrand !== "";
export const brandName = isWhiteLabel ? configuredBrand : "croc";
export const showCommunity = !isWhiteLabel;

/** "croc code" upstream, "transfer code" in white-label builds. */
export const codeLabel = isWhiteLabel ? "transfer code" : "croc code";
export const CodeLabel = isWhiteLabel ? "Transfer code" : "Croc code";

export function brandInitials(name = brandName): string {
  const words = name.split(/\s+/).filter(Boolean);
  const initials =
    words.length > 1 ? `${words[0][0]}${words[1][0]}` : name.slice(0, 2);
  return initials.toUpperCase();
}
