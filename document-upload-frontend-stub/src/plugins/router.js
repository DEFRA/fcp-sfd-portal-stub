import { fileURLToPath } from 'node:url'
import path from 'node:path'

async function loadRoutes () {
  const routesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../routes')
  const routeFiles = [
    'health.js',
    'redirect.js'
  ]

  const routes = []

  for (const file of routeFiles) {
    const filePath = path.join(routesDir, file)
    const module = await import(filePath)

    for (const key of Object.keys(module)) {
      if (typeof module[key] === 'object' && module[key].method && module[key].path) {
        routes.push(module[key])
      }
    }
  }

  return routes
}

export const router = {
  name: 'router',
  version: '1.0.0',
  register: async (server) => {
    const routes = await loadRoutes()
    server.route(routes)
  }
}
