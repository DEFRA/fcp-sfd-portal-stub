import Hapi from '@hapi/hapi'
import Joi from 'joi'
import { config } from './config/config.js'
import { router } from './plugins/router.js'
import { createLogger } from './logger.js'

export async function createServer () {
  const logger = createLogger()

  const server = Hapi.server({
    host: config.get('host'),
    port: config.get('port'),
    routes: {
      validate: {
        options: {
          abortEarly: false,
          allowUnknown: true,
          stripUnknown: true
        }
      },
      cors: {
        origin: ['*'],
        credentials: true
      }
    },
    router: {
      stripTrailingSlash: true
    }
  })

  server.validator(Joi)

  server.decorate('request', 'logger', logger)

  await server.register([
    router
  ])

  return server
}
