import { defineConfig, type HtmlTagDescriptor, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const backendOrigins = new Set([
  "https://script.google.com",
  "https://script.googleusercontent.com",
  ...(process.env.VITE_APPS_SCRIPT_URL ? [new URL(process.env.VITE_APPS_SCRIPT_URL).origin] : []),
]);

const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https://drive.google.com https://*.googleusercontent.com",
  `connect-src ${[...backendOrigins].join(" ")}`,
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

// Netlify supplies the site's full address as URL. Add an og:image here once there is a real shop photo.
const siteUrl = process.env.URL;
const shareTags: HtmlTagDescriptor[] = siteUrl
  ? [
      { tag: "meta", attrs: { property: "og:url", content: siteUrl }, injectTo: "head" },
    ]
  : [];

// Build only, because the dev server relies on inline scripts for hot reload.
const productionTags: Plugin = {
  name: "production-tags",
  apply: "build",
  transformIndexHtml: () => [
    { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CONTENT_SECURITY_POLICY }, injectTo: "head-prepend" },
    ...shareTags,
  ],
};

// Relative base so the build works at any address without knowing it.
export default defineConfig({
  base: "./",
  plugins: [react(), productionTags],
  server: { port: 5173 },
});
