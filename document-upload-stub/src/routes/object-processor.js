import { randomUUID } from 'node:crypto'
import { config } from '../config/config.js'

// In-memory storage for upload sessions
const uploadSessions = new Map()

export const initiatePost = {
  method: 'POST',
  path: '/api/v1/initiate',
  handler: (request, h) => {
    const { metadata } = request.payload

    const correlationId = randomUUID()
    const uploadId = randomUUID()
    const uploaderHost = config.get('uploaderHost')
    const uploadUrl = `${uploaderHost}/upload-and-scan/${uploadId}`
    const statusUrl = `http://document-upload-stub:3021/api/v1/status/${correlationId}`

    // Store session in memory
    uploadSessions.set(correlationId, {
      correlationId,
      uploadId,
      metadata,
      status: 'IN_PROGRESS',
      createdAt: new Date().toISOString()
    })

    request.logger.info({ correlationId, uploadId }, 'Upload initiated')

    return h.response({
      correlationId,
      uploadId,
      uploadUrl,
      statusUrl
    }).code(200)
  }
}

export const statusGet = {
  method: 'GET',
  path: '/api/v1/status/{correlationId}',
  handler: (request, h) => {
    const { correlationId } = request.params

    const session = uploadSessions.get(correlationId)

    if (!session) {
      return h.response({
        error: 'Upload session not found'
      }).code(404)
    }

    request.logger.info({ correlationId, status: session.status }, 'Status checked')

    return h.response({
      correlationId: session.correlationId,
      status: session.status,
      metadata: session.metadata,
      message: session.message,
      numberOfRejectedFiles: session.numberOfRejectedFiles,
      numberOfFiles: session.numberOfFiles || 0,
      fileNames: session.fileNames || []
    }).code(200)
  }
}

export function updateSessionStatus (correlationId, status, message, numberOfRejectedFiles) {
  const session = uploadSessions.get(correlationId)
  if (session) {
    session.status = status
    session.message = message
    session.numberOfRejectedFiles = numberOfRejectedFiles
    uploadSessions.set(correlationId, session)
  }
}

export function getSessionByUploadId (uploadId) {
  for (const [, session] of uploadSessions) {
    if (session.uploadId === uploadId) {
      return session
    }
  }
  return null
}
