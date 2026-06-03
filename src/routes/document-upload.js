import { randomUUID } from 'node:crypto'
import { config } from '../config/config.js'
import { initiateUpload, getUploadStatus } from '../common/helpers/object-processor.js'
import { HttpError } from '../common/helpers/http-error.js'
import { UPLOAD_STATUS } from '../common/constants/upload-status.js'

export const signInGet = {
  method: 'GET',
  path: '/document-upload/sign-in',
  handler: (request, h) => {
    return h.view('document-upload/sign-in', {
      pageTitle: 'Sign in to upload documents'
    })
  }
}

export const signInPost = {
  method: 'POST',
  path: '/document-upload/sign-in',
  handler: (request, h) => {
    const { crn } = request.payload

    request.yar.set('crn', crn)

    return h.redirect('/document-upload/metadata')
  }
}

export const metadataGet = {
  method: 'GET',
  path: '/document-upload/metadata',
  handler: (request, h) => {
    const crn = request.yar.get('crn')

    if (!crn) {
      return h.redirect('/document-upload/sign-in')
    }

    return h.view('document-upload/metadata', {
      pageTitle: 'Enter document details',
      crn
    })
  }
}

export const metadataPost = {
  method: 'POST',
  path: '/document-upload/metadata',
  handler: async (request, h) => {
    const { sbi, crn, frn, reference, type, service } = request.payload

    // Generate submission details
    const submissionId = randomUUID()
    const uosr = `${sbi}_${submissionId}`

    const metadata = {
      sbi: parseInt(sbi, 10),
      crn: parseInt(crn, 10),
      frn: parseInt(frn, 10),
      submissionId,
      uosr,
      type,
      reference,
      service
    }

    try {
      const uploadMode = config.get('uploadMode')
      let redirect = config.get('redirectAfterUpload')

      // In frontend-redirect mode, prepend client identifier prefix so NGINX routes to frontend stub
      if (uploadMode === 'frontend-redirect') {
        const clientIdentifier = 'portal-stub'
        redirect = `/fcp-sfd-doc-upload/${clientIdentifier}${redirect}`
      }

      const result = await initiateUpload(metadata, redirect)

      let uploadUrl = result.uploadUrl

      // In gateway-routing and frontend-redirect modes, uploads go through gateway
      // This keeps all traffic through a single domain, simplifying CSP
      if (uploadMode === 'gateway-routing' || uploadMode === 'frontend-redirect') {
        const gatewayUrl = config.get('gatewayUrl')
        uploadUrl = `${gatewayUrl}/upload-and-scan/${result.uploadId}`
      }
      // In direct mode, browser uploads directly to CDP Uploader

      request.yar.set('metadata', metadata)
      request.yar.set('submissionId', submissionId)
      request.yar.set('uploadUrl', uploadUrl)
      request.yar.set('statusUrl', result.statusUrl)
      request.yar.set('uploadId', result.uploadId)
      request.yar.set('correlationId', result.correlationId)

      return h.redirect('/document-upload/upload')
    } catch (error) {
      request.logger.error({ error }, 'Failed to initiate upload')

      return h.view('document-upload/metadata', {
        pageTitle: 'Enter document details',
        crn,
        error: 'Failed to initiate upload. Please try again.'
      })
    }
  }
}

export const uploadGet = {
  method: 'GET',
  path: '/document-upload/upload',
  handler: (request, h) => {
    const metadata = request.yar.get('metadata')
    const uploadUrl = request.yar.get('uploadUrl')
    const uploadMode = config.get('uploadMode')

    if (!metadata || !uploadUrl) {
      return h.redirect('/document-upload/sign-in')
    }

    return h.view('document-upload/upload', {
      pageTitle: 'Upload files',
      metadata,
      uploadUrl,
      uploadMode
    })
  }
}

export const processingGet = {
  method: 'GET',
  path: '/document-upload/processing',
  handler: (request, h) => {
    const submissionId = request.yar.get('submissionId')
    const metadata = request.yar.get('metadata')
    const uploadedFiles = request.yar.get('uploadedFiles') || []

    if (!submissionId || !metadata) {
      return h.redirect('/document-upload/sign-in')
    }

    return h.view('document-upload/processing', {
      pageTitle: 'Processing your upload',
      submissionId,
      reference: metadata.reference,
      numberOfFiles: uploadedFiles.length,
      uploadedFiles,
      uploadStatus: 'scanning'
    })
  }
}

export const checkStatusGet = {
  method: 'GET',
  path: '/document-upload/check-status',
  handler: async (request, h) => {
    const statusUrl = request.yar.get('statusUrl')
    const metadata = request.yar.get('metadata')

    if (!metadata || !statusUrl) {
      return h.redirect('/document-upload/sign-in')
    }

    try {
      const status = await getUploadStatus(statusUrl)
      request.logger.info({ statusUrl, status: status.data.uploadStatus }, 'Checked upload status')

      if (status.data.uploadStatus === UPLOAD_STATUS.SUCCESS) {
        return h.redirect('/document-upload/success')
      }

      if (status.data.uploadStatus === UPLOAD_STATUS.FAILURE) {
        const form = status.data.form || {}
        const rejectedFiles = Object.entries(form)
          .filter(([, fileData]) => fileData.hasError)
          .map(([fileName, fileData]) => ({ fileName, errorMessage: fileData.errorMessage }))
        request.yar.set('rejectedFiles', rejectedFiles)
        return h.redirect('/document-upload/error')
      }

      return h.redirect('/document-upload/processing')
    } catch (error) {
      request.logger.error({ error }, 'Failed to check upload status')

      if (error instanceof HttpError && error.statusCode >= 400 && error.statusCode < 500) {
        return h.redirect('/document-upload/error')
      }

      if (error instanceof HttpError && error.statusCode >= 500) {
        request.yar.set('rejectedFiles', [])
        return h.redirect('/document-upload/error')
      }

      return h.redirect('/document-upload/processing')
    }
  }
}

export const errorGet = {
  method: 'GET',
  path: '/document-upload/error',
  handler: (request, h) => {
    const submissionId = request.yar.get('submissionId')
    const metadata = request.yar.get('metadata')
    const uploadedFiles = request.yar.get('uploadedFiles') || []
    const rejectedFiles = request.yar.get('rejectedFiles') || []

    if (!submissionId || !metadata) {
      return h.redirect('/document-upload/sign-in')
    }

    return h.view('document-upload/error', {
      pageTitle: 'Upload failed',
      submissionId,
      reference: metadata.reference,
      numberOfFiles: uploadedFiles.length,
      uploadedFiles,
      rejectedFiles
    })
  }
}

export const successGet = {
  method: 'GET',
  path: '/document-upload/success',
  handler: async (request, h) => {
    const submissionId = request.yar.get('submissionId')
    const statusUrl = request.yar.get('statusUrl')
    const metadata = request.yar.get('metadata')
    const uploadedFiles = request.yar.get('uploadedFiles') || []

    if (!metadata || !statusUrl) {
      return h.redirect('/document-upload/sign-in')
    }

    try {
      const status = await getUploadStatus(statusUrl)

      if (status.data.uploadStatus !== UPLOAD_STATUS.SUCCESS) {
        return h.redirect('/document-upload/processing')
      }

      const fileNames = Object.keys(status.data.form || {})

      return h.view('document-upload/success', {
        pageTitle: 'Upload successful',
        submissionId,
        reference: metadata.reference,
        uploadStatus: status.data.uploadStatus,
        numberOfFiles: fileNames.length || uploadedFiles.length,
        uploadedFiles: fileNames.length ? fileNames : uploadedFiles
      })
    } catch (error) {
      request.logger.error({ error }, 'Failed to get upload status')

      // Show success page with session data on error
      return h.view('document-upload/success', {
        pageTitle: 'Upload successful',
        submissionId,
        reference: metadata.reference,
        uploadStatus: 'completed',
        numberOfFiles: uploadedFiles.length,
        uploadedFiles
      })
    }
  }
}
