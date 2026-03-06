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
  documentUploadFrontend: {
    enabled: {
      doc: 'Whether document upload frontend integration is enabled',
      format: Boolean,
      default: false,
      env: 'DOCUMENT_UPLOAD_FRONTEND_ENABLED'
    },
    host: {
      doc: 'The base URL for the document upload frontend service',
      format: String,
      default: 'http://document-upload-frontend-stub:3022',
      env: 'DOCUMENT_UPLOAD_FRONTEND_HOST'
    },
    clientIdentifier: {
      doc: 'Client identifier for redirect mapping',
      format: String,
      default: 'portal-stub',
      env: 'CLIENT_IDENTIFIER'
    }
  }
})

config.validate({ allowed: 'strict' })

export { config }
