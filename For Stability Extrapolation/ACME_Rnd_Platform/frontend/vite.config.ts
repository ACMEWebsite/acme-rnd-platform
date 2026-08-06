import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const MAX_REGISTRY_DOCUMENT_BYTES = 30 * 1024 * 1024;

function isAllowedRegistryDocument(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;

    if (url.hostname === "dailymed.nlm.nih.gov") {
      return url.pathname.toLowerCase() === "/dailymed/downloadpdffile.cfm";
    }

    return /^mhraproducts\d+\.blob\.core\.windows\.net$/i.test(url.hostname)
      && url.pathname.toLowerCase().startsWith("/docs/");
  } catch {
    return false;
  }
}

function registryDocumentDevBridge(): Plugin {
  return {
    name: "registry-document-dev-bridge",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const requestUrl = new URL((request as {url?: string}).url ?? "/", "http://localhost");
        if (requestUrl.pathname !== "/dev-registry-document/") {
          next();
          return;
        }

        let target = requestUrl.searchParams.get("url") ?? "";
        if (!isAllowedRegistryDocument(target)) {
          response.statusCode = 400;
          response.end("Unsupported registry document URL.");
          return;
        }

        try {
          let upstream: Response | undefined;
          for (let redirectCount = 0; redirectCount < 5; redirectCount += 1) {
            if (!isAllowedRegistryDocument(target)) {
              throw new Error("The document redirected to an unsupported host.");
            }

            upstream = await fetch(target, {redirect: "manual"});
            if ([301, 302, 303, 307, 308].includes(upstream.status)) {
              const location = upstream.headers.get("location");
              if (!location) throw new Error("The document redirect was incomplete.");
              target = new URL(location, target).toString();
              continue;
            }
            break;
          }

          if (!upstream?.ok) {
            throw new Error(`The document server returned ${upstream?.status ?? "no response"}.`);
          }

          const documentBytes = new Uint8Array(await upstream.arrayBuffer());
          if (documentBytes.byteLength > MAX_REGISTRY_DOCUMENT_BYTES) {
            response.statusCode = 413;
            response.end("The registry document is too large to preview.");
            return;
          }

          response.statusCode = 200;
          response.setHeader("Content-Type", "application/pdf");
          response.setHeader("Content-Disposition", 'inline; filename="Registry_Document.pdf"');
          response.setHeader("Content-Length", String(documentBytes.byteLength));
          response.setHeader("X-Content-Type-Options", "nosniff");
          response.end(documentBytes);
        } catch {
          response.statusCode = 502;
          response.end("The registry document could not be loaded.");
        }
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const environment = loadEnv(mode, ".", "");
  const apiProxyTarget = environment.VITE_API_PROXY_TARGET?.trim() || "http://localhost:80";

  return {
    plugins: [react(), registryDocumentDevBridge()],
    server: {
      proxy: {
        "/api": {target: apiProxyTarget, changeOrigin: true},
        "/health": {target: apiProxyTarget, changeOrigin: true},
      },
    },
  };
});
