import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'dist/**', '.wrangler/**', '.openai/**', 'next-env.d.ts']),
  // Static picture/srcset assets are pre-optimised; Vinext has no Next image server.
  { rules: { '@next/next/no-img-element': 'off', '@next/next/no-html-link-for-pages': 'off' } },
]);

export default eslintConfig;
