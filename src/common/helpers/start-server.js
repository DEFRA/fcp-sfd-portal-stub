import { createServer } from '../../server.js'
import { config } from '../../config/config.js'
import { createLogger } from './logging/logger.js'

async function startServer () {
  let server

  try {
    server = await createServer()
    await server.start()

    const logger = createLogger()
    const uploadMode = config.get('uploadMode')
    logger.info({ uploadMode }, `Portal running in upload mode: ${uploadMode}`)
    logger.info('Server started successfully')
    logger.info(
      `Access your frontend on http://localhost:${config.get('port')}`
    )
  } catch (err) {
    const logger = createLogger()
    logger.info('Server failed to start')
    logger.error(err)
  }

  return server
}

export { startServer }
