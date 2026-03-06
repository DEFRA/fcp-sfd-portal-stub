import convict from 'convict'

const config = convict({
  env: {
    doc: 'The application environment.',
    format: ['production', 'development', 'test'],
    default: 'development',
    env: 'NODE_ENV'
  },
  port: {
    doc: 'The port to bind.',
    format: 'port',
    default: 3021,
    env: 'PORT'
  },
  host: {
    doc: 'The host to bind.',
    format: String,
    default: '0.0.0.0',
    env: 'HOST'
  },
  logLevel: {
    doc: 'Logging level',
    format: ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'],
    default: 'info',
    env: 'LOG_LEVEL'
  },
  uploaderHost: {
    doc: 'The base URL for the stub uploader',
    format: String,
    default: 'http://localhost:3021',
    env: 'UPLOADER_HOST'
  },
  gatewayUrl: {
    doc: 'The gateway URL for frontend-redirect mode',
    format: String,
    default: 'http://localhost:3019',
    env: 'GATEWAY_URL'
  }
})

config.validate({ allowed: 'strict' })

export { config }
