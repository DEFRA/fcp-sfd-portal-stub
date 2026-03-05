import { getSessionByUploadId, updateSessionStatus } from './object-processor.js'

export const uploadPost = {
  method: 'POST',
  path: '/upload-and-scan/{uploadId}',
  options: {
    payload: {
      output: 'stream',
      parse: true,
      multipart: true,
      maxBytes: 1024 * 1024 * 100 // 100MB
    }
  },
  handler: async (request, h) => {
    const { uploadId } = request.params

    request.logger.info({ uploadId }, 'File upload received')

    // Find the session by uploadId
    const session = getSessionByUploadId(uploadId)

    if (!session) {
      request.logger.error({ uploadId }, 'Upload session not found')
      return h.response({ error: 'Upload session not found' }).code(404)
    }

    // Simulate virus scanning delay
    setTimeout(() => {
      request.logger.info({ correlationId: session.correlationId, uploadId }, 'Marking upload as successful')
      updateSessionStatus(session.correlationId, 'SUCCESSFUL', 'Files uploaded and scanned successfully', 0)
    }, 2000)

    // Make redirect relative (strip protocol/host) to simulate real CDP Uploader behavior
    const relativeRedirect = session.redirect.replace(/^https?:\/\/[^/]+/, '')

    request.logger.info({ correlationId: session.correlationId, redirect: relativeRedirect }, 'Redirecting after upload')

    return h.redirect(relativeRedirect).code(302)
  }
}
