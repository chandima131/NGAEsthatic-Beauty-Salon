import template from '../dist/client/index.html?raw';
import { handleRequest } from './handler';
import type { ReviewEnvironment } from './google-reviews';

export { handleRequest };
export default {
  async fetch(request: Request, env: ReviewEnvironment & { ASSETS: { fetch(request: Request): Promise<Response> } }) {
    return await handleRequest(request, env, template) ?? env.ASSETS.fetch(request);
  },
};
