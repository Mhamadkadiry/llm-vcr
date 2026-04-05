import { setupServer } from 'msw/node';
import type { RequestHandler } from 'msw';

export function createInterceptor(handlers: RequestHandler[]) {
  const server = setupServer(...handlers);
  return {
    start() {
      server.listen({ onUnhandledRequest: 'bypass' });
    },
    stop() {
      server.close();
    },
  };
}
