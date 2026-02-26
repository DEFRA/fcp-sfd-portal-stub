import Inert from '@hapi/inert'
import { health } from '../routes/health.js'
import { index } from '../routes/index.js'
import {
  signInGet,
  signInPost,
  metadataGet,
  metadataPost,
  uploadGet,
  processingGet,
  checkStatusGet,
  errorGet,
  successGet
} from '../routes/document-upload.js'
import { serveStaticFiles } from '../common/helpers/serve-static-files.js'

export const router = {
  plugin: {
    name: 'router',
    async register (server) {
      await server.register([Inert])
      await server.route(health)
      await server.route(index)

      // Document upload routes
      await server.route(signInGet)
      await server.route(signInPost)
      await server.route(metadataGet)
      await server.route(metadataPost)
      await server.route(uploadGet)
      await server.route(processingGet)
      await server.route(checkStatusGet)
      await server.route(errorGet)
      await server.route(successGet)

      await server.register([serveStaticFiles])
    }
  }
}
