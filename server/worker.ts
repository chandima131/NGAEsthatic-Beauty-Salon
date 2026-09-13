import template from '../dist/client/index.html?raw';
import { handleRequest } from './handler';

export { handleRequest };
export default {
  async fetch(request: Request, env: { ASSETS: { fetch(request: Request): Promise<Response> } }) {
    return await handleRequest(request, template) ?? env.ASSETS.fetch(request);
  },
};
