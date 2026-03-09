import process from 'node:process'
import { createServer } from './server.js'
import { createLogger } from './logger.js'

const logger = createLogger()

async function start () {
  const server = await createServer()
  await server.start()
  logger.info(`Document Upload Frontend Stub running at ${server.info.uri}`)
}

start()

process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'Unhandled rejection')
  process.exitCode = 1
})
