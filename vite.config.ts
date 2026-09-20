import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

type BuildTarget = 'background' | 'content';

function copyRootAssets(): Plugin {
  return {
    name: 'copy-root-assets',
    generateBundle() {
      for (const fileName of ['manifest.json', 'glossary.json']) {
        this.emitFile({
          type: 'asset',
          fileName,
          source: readFileSync(resolve(process.cwd(), fileName), 'utf8')
        });
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  if (mode !== 'background' && mode !== 'content') {
    throw new Error(`Unsupported build mode: ${mode}`);
  }

  const target: BuildTarget = mode;

  return {
    plugins: [copyRootAssets()],
    build: {
      emptyOutDir: target === 'background',
      sourcemap: false,
      rollupOptions: {
        input: resolve(process.cwd(), `src/${target}.ts`),
        output: {
          format: 'iife',
          entryFileNames: `${target}.js`,
          chunkFileNames: `${target}-chunk.js`,
          assetFileNames: '[name][extname]'
        }
      }
    }
  };
});
