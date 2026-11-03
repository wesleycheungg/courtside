import type { Connect, Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Serves the `api/` edge handlers during `npm run dev`.
 *
 * In production Vercel runs these; locally Vite would otherwise 404 them,
 * leaving no way to exercise the ESPN provider without `vercel dev` and a
 * login. The handlers are loaded through Vite's module runner, so they get the
 * same TypeScript and hot-reload treatment as the app.
 */
export function apiDev(): Plugin {
  return {
    name: 'courtside:api-dev',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      const middleware: Connect.NextHandleFunction = (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/')) return next();

        void handle(server, req, res).catch((error: unknown) => {
          server.config.logger.error(`[api-dev] ${String(error)}`);
          res.statusCode = 500;
          res.end(
            JSON.stringify({ error: 'dev_handler_failed', message: String(error) }),
          );
        });
      };

      server.middlewares.use(middleware);
    },
  };
}

async function handle(
  server: ViteDevServer,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const route = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');

  // Only expose real route files; `_lib` and anything path-traversal shaped stay private.
  if (!/^[a-z][a-z0-9-]*$/.test(route)) {
    res.statusCode = 404;
    res.end(
      JSON.stringify({ error: 'not_found', message: `No API route /api/${route}` }),
    );
    return;
  }

  let handler: (request: Request) => Promise<Response>;
  try {
    const mod = (await server.ssrLoadModule(`/api/${route}.ts`)) as {
      default: (request: Request) => Promise<Response>;
    };
    handler = mod.default;
  } catch {
    res.statusCode = 404;
    res.end(
      JSON.stringify({ error: 'not_found', message: `No API route /api/${route}` }),
    );
    return;
  }

  const response = await handler(new Request(`http://localhost${req.url}`));

  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}
