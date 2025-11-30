// vite.config.prod.ts
import { mergeConfig, defineConfig } from 'vite'
import base from './vite.config.base'
import federation from '@originjs/vite-plugin-federation'
import { federationShared } from './vite.config.base'

export default mergeConfig(
  base,
  defineConfig({
    plugins: [
      federation({
        name: 'audit_app',
        filename: 'assets/remoteEntry.js',
        exposes: {
          './AuditWidget': './src/AuditWidget.tsx'
        },
        shared: federationShared
      })
    ],

    base: '/audit/',

    define: {
      __DEV__: false,
      __PROD__: true
    },

    build: {
      target: 'es2018',
      outDir: 'dist',
      minify: 'esbuild',
      sourcemap: false,
      cssCodeSplit: true,
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      } as any
    }
  })
)
