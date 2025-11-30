// vite.config.local.ts
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
        filename: 'remoteEntry.js',
        exposes: {
          './AuditWidget': './src/AuditWidget.tsx'
        },
        shared: federationShared
      })
    ],

    server: {
      port: 3003,
      host: 'localhost',
      strictPort: true,
      open: true
    },

    define: {
      __DEV__: true,
      __PROD__: false
    },

    build: {
      sourcemap: true
    }
  })
)
