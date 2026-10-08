import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

type BuildTarget = 'background' | 'content' | 'options' | 'popup' | 'history';

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
      for (const iconName of ['icon-16.png', 'icon-32.png', 'icon-48.png', 'icon-128.png']) {
        this.emitFile({
          type: 'asset',
          fileName: `icons/${iconName}`,
          source: readFileSync(resolve(process.cwd(), 'icons', iconName))
        });
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  if (
    mode !== 'background' &&
    mode !== 'content' &&
    mode !== 'options' &&
    mode !== 'popup' &&
    mode !== 'history'
  ) {
    throw new Error(`Unsupported build mode: ${mode}`);
  }

  const target: BuildTarget = mode;
  const pageTarget = target === 'options' || target === 'popup' || target === 'history';
  const root = pageTarget
    ? resolve(process.cwd(), `src/${target}`)
    : process.cwd();
  const input = pageTarget
    ? resolve(process.cwd(), `src/${target}/${target}.html`)
    : resolve(process.cwd(), `src/${target}.ts`);

  return {
    root,
    plugins: [copyRootAssets()],
    build: {
      outDir: resolve(process.cwd(), 'dist'),
      emptyOutDir: target === 'background',
      cssCodeSplit: pageTarget,
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
