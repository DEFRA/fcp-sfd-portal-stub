import { getSessionByUploadId, updateSessionStatus } from './object-processor.js'
import { UPLOAD_STATUS } from '../common/constants/upload-status.js'

// Builds the CDP Uploader-style form object from the uploaded file parts,
// keyed by file name, so multi-file submissions are reported back accurately.
function buildFormFromPayload (payload) {
  const fileField = payload?.['file-upload']
  const files = Array.isArray(fileField) ? fileField : [fileField].filter(Boolean)

  return files.reduce((form, file) => {
    const fileName = file?.hapi?.filename

    if (fileName) {
      form[fileName] = { fileStatus: 'accepted', hasError: false }
    }

    return form
  }, {})
}

export const uploadPost = {
  method: 'POST',
  path: '/upload-and-scan/{uploadId}',
  options: {
    payload: {
      output: 'data',
      parse: true,
      multipart: true,
      maxBytes: 1024 * 1024 * 100 // 100MB
    }
  },
  handler: async (request, h) => {
    const { uploadId } = request.params
    const form = buildFormFromPayload(request.payload)

    request.logger.info({ uploadId, fileCount: Object.keys(form).length }, 'File upload received')

    // Find the session by uploadId
    const session = getSessionByUploadId(uploadId)

    if (!session) {
      request.logger.error({ uploadId }, 'Upload session not found')
      return h.response({ error: 'Upload session not found' }).code(404)
    }

    // Simulate virus scanning delay
    setTimeout(() => {
      request.logger.info({ correlationId: session.correlationId, uploadId }, 'Marking upload as successful')
      updateSessionStatus(session.correlationId, UPLOAD_STATUS.SUCCESS, form)
    }, 2000)

    // Return relative redirect (browser resolves to originating domain)
    // In gateway-routing and frontend-redirect modes, requests come through gateway, so redirect resolves to gateway
    // This allows NGINX to route /fcp-sfd-doc-upload/ paths to the frontend stub
    const redirectUrl = session.redirect.replace(/^https?:\/\/[^/]+/, '')
    request.logger.info({ correlationId: session.correlationId, redirect: redirectUrl }, 'Redirecting after upload')

    return h.redirect(redirectUrl).code(302)
  }
}
