import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

function inlineCss(): Plugin {
  return {
    name: "inline-css",
    enforce: "post",
    generateBundle(_options, bundle) {
      const stylesheetLink =
        /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/gi;
      const inlinedCss = new Set<string>();

      for (const output of Object.values(bundle)) {
        if (output.type !== "asset" || !output.fileName.endsWith(".html")) {
          continue;
        }

        const html = String(output.source).replace(
          stylesheetLink,
          (link, href: string) => {
            const fileName = new URL(href, "https://vite.invalid/").pathname
              .replace(/^\//, "");
            const stylesheet = bundle[fileName];

            if (
              stylesheet?.type !== "asset" ||
              !stylesheet.fileName.endsWith(".css")
            ) {
              return link;
            }

            inlinedCss.add(fileName);
            const css = String(stylesheet.source).replace(
              /<\/style/gi,
              "<\\/style",
            );
            return `<style data-croc-inline-css>${css}</style>`;
          },
        );

        output.source = html;
      }

      for (const fileName of inlinedCss) {
        delete bundle[fileName];
      }
    },
  };
}

// White-label builds set VITE_BRAND_NAME (the Docker build arg
// CROC_BRAND_NAME). It is compiled in as a constant so that branded bundles
// drop the upstream croc content, links, and blog entirely.
const brandName = (process.env.VITE_BRAND_NAME ?? "").trim();

function escapeHTML(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function brandInitials(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2))
    .toUpperCase();
}

function brandFavicon(name: string) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#818cf8"/>` +
    `</linearGradient></defs>` +
    `<rect width="64" height="64" rx="16" fill="url(#g)"/>` +
    `<text x="32" y="41" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" ` +
    `font-size="26" font-weight="700" fill="#fff">${escapeHTML(brandInitials(name))}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const blogStubId = "\0white-label-blog-posts";
const blogSEOStubId = "\0white-label-blog-seo";

/**
 * White-label builds: replace the upstream croc SEO block in index.html with
 * brand metadata, swap the blog data modules for empty stubs (their top-level
 * code would otherwise keep upstream text in the bundle), and drop the
 * donation-banner styles.
 */
function whiteLabelHtml(): Plugin {
  return {
    name: "white-label-html",
    enforce: "pre",
    resolveId(source) {
      if (!brandName) return null;
      if (/(^|\/)blog-posts(\.ts)?$/.test(source)) return blogStubId;
      if (/(^|\/)blog-seo\.json$/.test(source)) return blogSEOStubId;
      return null;
    },
    load(id) {
      if (id === blogStubId) {
        return [
          "export const blogPosts = [];",
          "export function getBlogPost() { return undefined; }",
          "export function blogWordCount() { return 0; }",
          "export function readingMinutes() { return 0; }",
        ].join("\n");
      }
      if (id === blogSEOStubId) {
        return "export default { site: {}, index: {}, posts: [] };";
      }
      return null;
    },
    generateBundle(_options, bundle) {
      if (!brandName) return;
      for (const output of Object.values(bundle)) {
        if (output.type === "asset" && output.fileName.endsWith(".css")) {
          output.source = String(output.source).replace(
            /[^{}]*\.donation-[^{}]*\{[^{}]*\}/g,
            "",
          );
        }
      }
    },
    transformIndexHtml(html) {
      if (!brandName) return html;
      const name = escapeHTML(brandName);
      const description = escapeHTML(
        `Send and receive end-to-end encrypted files with ${brandName}.`,
      );
      const head = `<!-- ROUTE_SEO_START -->
    <meta name="application-name" content="${name}" />
    <meta name="description" content="${description}" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${name}" />
    <meta property="og:title" content="${name}" />
    <meta property="og:description" content="${description}" />
    <link rel="icon" type="image/svg+xml" href="${brandFavicon(brandName)}" />
    <title>${name} — secure file transfer</title>
    <!-- ROUTE_SEO_END -->`;
      const branded = html.replace(
        /<!-- ROUTE_SEO_START -->[\s\S]*?<!-- ROUTE_SEO_END -->/,
        head,
      );
      if (branded === html) {
        throw new Error("index.html is missing the route SEO markers");
      }
      return branded;
    },
  };
}

const gatewayProxy =
  process.env.CROC_GATEWAY_PROXY ?? "ws://127.0.0.1:9014";

export default defineConfig({
  plugins: [react(), whiteLabelHtml(), inlineCss()],
  define: {
    "import.meta.env.VITE_BRAND_NAME": JSON.stringify(brandName),
  },
  server: {
    fs: {
      allow: [".."],
    },
    host: "127.0.0.1",
    proxy: {
      "/ws": {
        target: gatewayProxy,
        ws: true,
      },
      "/healthz": {
        target: gatewayProxy.replace(/^ws/, "http"),
      },
      "/api": {
        target: gatewayProxy.replace(/^ws/, "http"),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
