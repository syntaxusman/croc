// White-label settings injected by croc-web (--brand-name, --hide-community).
// Without them the client keeps the upstream croc branding and content.
const runtimeBrand =
  (typeof window === "undefined" ? undefined : window.__CROC_RUNTIME_CONFIG__?.brand) ??
  {};

export const brandName = runtimeBrand.name?.trim() || "croc";
export const isWhiteLabel = brandName !== "croc";
export const showCommunity = runtimeBrand.community !== false;

export function brandInitials(name = brandName): string {
  const words = name.split(/\s+/).filter(Boolean);
  const initials =
    words.length > 1 ? `${words[0][0]}${words[1][0]}` : name.slice(0, 2);
  return initials.toUpperCase();
}
