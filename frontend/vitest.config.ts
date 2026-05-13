import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// REQ-023 (E3.S2): Vitest config — adds path-alias resolution + the @vitejs/plugin-react
// JSX/TSX transform so component tests can import `@/...` and render React trees.
// Existing module-level tests (members.test.ts, users.test.ts) keep working unchanged
// because they only import relative paths.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Node by default; component tests opt into jsdom via `// @vitest-environment jsdom`.
    environment: 'node',
  },
});
