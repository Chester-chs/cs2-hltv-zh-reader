import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

type BuildTarget = 'background' | 'content' | 'options';

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
  if (mode !== 'background' && mode !== 'content' && mode !== 'options') {
    throw new Error(`Unsupported build mode: ${mode}`);
  }

  const target: BuildTarget = mode;
  const optionsTarget = target === 'options';
  const root = optionsTarget
    ? resolve(process.cwd(), 'src/options')
    : process.cwd();
  const input = optionsTarget
    ? resolve(process.cwd(), 'src/options/options.html')
    : resolve(process.cwd(), `src/${target}.ts`);

  return {
    root,
    plugins: [copyRootAssets()],
    build: {
      outDir: resolve(process.cwd(), 'dist'),
      emptyOutDir: target === 'background',
      cssCodeSplit: optionsTarget,
      sourcemap: false,
      rollupOptions: {
        input,
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
