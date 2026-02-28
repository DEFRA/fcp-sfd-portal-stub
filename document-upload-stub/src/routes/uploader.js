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

    // CDP Uploader returns 302 redirect on successful upload acceptance
    // The portal client-side code intercepts this and redirects to /document-upload/processing
    // We redirect to a different URL to verify the intercept logic works
    return h.redirect('http://localhost:3021/upload-accepted').code(302)
  }
}
