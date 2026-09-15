import template from '../dist/client/index.html?raw';
import { handleRequest } from './handler';
import type { BookingEnvironment } from './booking-api';

type Environment = BookingEnvironment & {
  ASSETS: { fetch(request: Request): Promise<Response> };
};

export { handleRequest };

export default {
  async fetch(request: Request, env: Environment) {
    return await handleRequest(request, template, env) ?? env.ASSETS.fetch(request);
  },
};