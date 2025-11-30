// vite.config.base.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

// Shared federation config (cast to any to avoid plugin typing issues)
export const federationShared = (({
  react: { singleton: true, requiredVersion: pkg.dependencies.react },
  'react-dom': { singleton: true, requiredVersion: pkg.dependencies['react-dom'] }
}) as unknown) as any

export default defineConfig({
  plugins: [react()],

  define: {
    __DEV__: false,
    __PROD__: false
  },

  build: {
    target: 'esnext'
  }
})
