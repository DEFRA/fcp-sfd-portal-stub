import pino from 'pino'
import { config } from './config/config.js'

export function createLogger () {
  const isDevelopment = config.get('env') === 'development'

  return pino({
    level: config.get('logLevel'),
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname'
          }
        }
      : undefined
  })
}
