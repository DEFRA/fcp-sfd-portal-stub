import { format } from 'date-fns'
import { randomUUID } from 'node:crypto'
import { initiateUpload, getUploadStatus } from '../common/helpers/object-processor.js'

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
    const submissionDateTime = format(new Date(), 'dd/MM/yyyy HH:mm:ss')

    const metadata = {
      sbi: parseInt(sbi, 10),
      crn: parseInt(crn, 10),
      frn: parseInt(frn, 10),
      submissionId,
      uosr,
      submissionDateTime,
      files: ['document.pdf'],
      filesInSubmission: 1,
      type,
      reference,
      service
    }

    try {
      const result = await initiateUpload(metadata)

      request.yar.set('metadata', metadata)
      request.yar.set('submissionId', submissionId)
      request.yar.set('uploadUrl', result.uploadUrl)
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

    if (!metadata || !uploadUrl) {
      return h.redirect('/document-upload/sign-in')
    }

    return h.view('document-upload/upload', {
      pageTitle: 'Upload files',
      metadata,
      uploadUrl
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
      request.logger.info({ statusUrl, status: status.uploadStatus }, 'Checked upload status')

      if (status.status === 'SUCCESSFUL') {
        return h.redirect('/document-upload/success')
      }

      if (status.status === 'REJECTED') {
        request.yar.set('rejectionReason', status.message)
        request.yar.set('numberOfRejectedFiles', status.numberOfRejectedFiles)
        return h.redirect('/document-upload/error')
      }

      return h.redirect('/document-upload/processing')
    } catch (error) {
      request.logger.error({ error }, 'Failed to check upload status')
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
    const numberOfRejectedFiles = request.yar.get('numberOfRejectedFiles') || uploadedFiles.length

    if (!submissionId || !metadata) {
      return h.redirect('/document-upload/sign-in')
    }

    return h.view('document-upload/error', {
      pageTitle: 'Upload failed',
      submissionId,
      reference: metadata.reference,
      numberOfFiles: uploadedFiles.length,
      numberOfRejectedFiles,
      uploadedFiles
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

      // Redirect if scan not successful or rejected
      if (status.status !== 'SUCCESSFUL') {
        if (status.status === 'REJECTED') {
          request.yar.set('rejectionReason', status.message)
          request.yar.set('numberOfRejectedFiles', status.numberOfRejectedFiles)
          return h.redirect('/document-upload/error')
        }
        return h.redirect('/document-upload/processing')
      }

      return h.view('document-upload/success', {
        pageTitle: 'Upload successful',
        submissionId,
        reference: metadata.reference,
        uploadStatus: status.uploadStatus,
        numberOfFiles: status.numberOfFiles || uploadedFiles.length,
        uploadedFiles
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
