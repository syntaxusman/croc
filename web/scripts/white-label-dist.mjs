// Removes upstream croc assets from a white-label build (VITE_BRAND_NAME set):
// the blog, croc artwork and icons, and the getcroc.com sitemap. Upstream
// builds (no brand) are left untouched.
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";

const brandName = (process.env.VITE_BRAND_NAME ?? "").trim();
if (!brandName) process.exit(0);

const distRoot = path.resolve(import.meta.dirname, "..", "dist");
const upstreamAssets = [
  "blog",
  "branding",
  "croc.png",
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "apple-touch-icon.png",
  "sitemap.xml",
];
for (const asset of upstreamAssets) {
  await rm(path.join(distRoot, asset), { recursive: true, force: true });
}
await writeFile(path.join(distRoot, "robots.txt"), "User-agent: *\nAllow: /\n");
console.log(`white-label build for ${brandName}: removed upstream assets`);
