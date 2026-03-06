import { getSessionByUploadId, updateSessionStatus } from './object-processor.js'
import { config } from '../config/config.js'

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

    // If redirect starts with /fcp-sfd-doc-upload/, return absolute redirect to gateway
    // This supports frontend-redirect mode where gateway proxies to frontend stub
    let redirectUrl = session.redirect.replace(/^https?:\/\/[^/]+/, '')

    if (redirectUrl.startsWith('/fcp-sfd-doc-upload/')) {
      const gatewayUrl = config.get('gatewayUrl')
      redirectUrl = `${gatewayUrl}${redirectUrl}`
      request.logger.info({ correlationId: session.correlationId, redirectUrl }, 'Redirecting to gateway (frontend-redirect mode)')
    } else {
      request.logger.info({ correlationId: session.correlationId, redirect: redirectUrl }, 'Redirecting after upload')
    }

    return h.redirect(redirectUrl).code(302)
  }
}
