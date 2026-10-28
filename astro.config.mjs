import process from 'node:process'
import cloudflare from '@astrojs/cloudflare'
import netlify from '@astrojs/netlify'
import node from '@astrojs/node'
import vercel from '@astrojs/vercel'
import edgeone from '@edgeone/astro'
import sentry from '@sentry/astro'
import { defineConfig } from 'astro/config'
import { provider } from 'std-env'

const adapterProvider = (process.env.HOME === '/dev/shm/home' && process.env.TMPDIR === '/dev/shm/tmp')
  ? 'edgeone'
  : process.env.SERVER_ADAPTER || provider

function resolveAdapter(name) {
  switch (name) {
    case 'vercel':
      return vercel({ isr: false, edgeMiddleware: false })
    case 'cloudflare_pages':
      return cloudflare()
    case 'netlify':
      return netlify({ cacheOnDemandPages: false, edgeMiddleware: false })
    case 'edgeone':
      return edgeone()
    case 'node':
    default:
      return node({ mode: 'standalone' })
  }
}

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: resolveAdapter(adapterProvider),
  integrations: [
    ...(process.env.SENTRY_DSN
      ? [
          sentry({
            enabled: {
              client: false,
              server: process.env.SENTRY_DSN,
            },
            dsn: process.env.SENTRY_DSN,
            sourceMapsUploadOptions: {
              enabled: process.env.SENTRY_PROJECT && process.env.SENTRY_AUTH_TOKEN,
              project: process.env.SENTRY_PROJECT,
              authToken: process.env.SENTRY_AUTH_TOKEN,
            },
          }),
        ]
      : []),
  ],
  vite: {
    ssr: {
      noExternal: process.env.DOCKER ? !!process.env.DOCKER : undefined,
      external: [
        ...adapterProvider === 'cloudflare_pages'
          ? [
              'module',
              'url',
              'events',
              'worker_threads',
              'async_hooks',
              'util',
              'node:diagnostics_channel',
              'node:net',
              'node:tls',
              'node:worker_threads',
              'node:util',
              'node:fs',
              'node:path',
              'node:process',
              'node:buffer',
              'node:string_decoder',
              'node:readline',
              'node:events',
              'node:stream',
              'node:assert',
              'node:os',
              'node:crypto',
              'node:zlib',
              'node:http',
              'node:https',
              'node:url',
              'node:querystring',
              'node:child_process',
              'node:inspector',
            ]
          : [],
      ],
    },
  },
})
