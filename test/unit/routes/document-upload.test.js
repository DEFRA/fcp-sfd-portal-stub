import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UPLOAD_STATUS } from '../../../src/common/constants/upload-status.js'

vi.mock('../../../src/config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'uploadMode') return 'gateway-routing'
      if (key === 'gatewayUrl') return 'http://localhost:3019'
      if (key === 'redirectAfterUpload') return '/document-upload/processing'
      return null
    })
  }
}))

vi.mock('../../../src/common/helpers/object-processor.js', () => ({
  initiateUpload: vi.fn(),
  getUploadStatus: vi.fn()
}))

const { checkStatusGet, successGet, errorGet } = await import('../../../src/routes/document-upload.js')
const { getUploadStatus } = await import('../../../src/common/helpers/object-processor.js')

function makeRequest (yarData = {}) {
  return {
    yar: {
      get: vi.fn((key) => yarData[key] ?? null),
      set: vi.fn()
    },
    logger: { info: vi.fn(), error: vi.fn() },
    payload: {}
  }
}

function makeH () {
  const h = {
    redirect: vi.fn().mockReturnThis(),
    view: vi.fn().mockReturnThis()
  }
  return h
}

describe('checkStatusGet handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to sign-in when session data is missing', async () => {
    const request = makeRequest({ metadata: null, statusUrl: null })
    const h = makeH()

    await checkStatusGet.handler(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/document-upload/sign-in')
  })

  it('redirects to success when status is success', async () => {
    const request = makeRequest({ metadata: { sbi: 1 }, statusUrl: 'http://op/status/1' })
    const h = makeH()

    getUploadStatus.mockResolvedValue({ data: { uploadStatus: UPLOAD_STATUS.SUCCESS, form: {} } })

    await checkStatusGet.handler(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/document-upload/success')
  })

  it('redirects to error and stores rejected files when status is failure', async () => {
    const request = makeRequest({ metadata: { sbi: 1 }, statusUrl: 'http://op/status/1' })
    const h = makeH()

    getUploadStatus.mockResolvedValue({
      data: {
        uploadStatus: UPLOAD_STATUS.FAILURE,
        form: {
          'virus.pdf': { fileStatus: 'rejected', hasError: true, errorMessage: 'Virus detected' },
          'clean.pdf': { fileStatus: 'accepted', hasError: false }
        }
      }
    })

    await checkStatusGet.handler(request, h)

    expect(request.yar.set).toHaveBeenCalledWith('rejectedFiles', [
      { fileName: 'virus.pdf', errorMessage: 'Virus detected' }
    ])
    expect(h.redirect).toHaveBeenCalledWith('/document-upload/error')
  })

  it('redirects to processing when status is pending', async () => {
    const request = makeRequest({ metadata: { sbi: 1 }, statusUrl: 'http://op/status/1' })
    const h = makeH()

    getUploadStatus.mockResolvedValue({ data: { uploadStatus: UPLOAD_STATUS.PENDING } })

    await checkStatusGet.handler(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/document-upload/processing')
  })

  it('redirects to processing when getUploadStatus throws', async () => {
    const request = makeRequest({ metadata: { sbi: 1 }, statusUrl: 'http://op/status/1' })
    const h = makeH()

    getUploadStatus.mockRejectedValue(new Error('network error'))

    await checkStatusGet.handler(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/document-upload/processing')
  })
})

describe('errorGet handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to sign-in when session data is missing', async () => {
    const request = makeRequest({ submissionId: null, metadata: null })
    const h = makeH()

    errorGet.handler(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/document-upload/sign-in')
  })

  it('renders error view with rejected files from session', async () => {
    const rejectedFiles = [{ fileName: 'virus.pdf', errorMessage: 'Virus detected' }]
    const request = makeRequest({
      submissionId: 'sub-1',
      metadata: { reference: 'REF-001' },
      uploadedFiles: ['virus.pdf'],
      rejectedFiles
    })
    const h = makeH()

    errorGet.handler(request, h)

    expect(h.view).toHaveBeenCalledWith('document-upload/error', expect.objectContaining({
      rejectedFiles,
      numberOfFiles: 1
    }))
  })

  it('renders error view with empty rejectedFiles when none in session', async () => {
    const request = makeRequest({
      submissionId: 'sub-1',
      metadata: { reference: 'REF-001' },
      uploadedFiles: []
    })
    const h = makeH()

    errorGet.handler(request, h)

    expect(h.view).toHaveBeenCalledWith('document-upload/error', expect.objectContaining({
      rejectedFiles: []
    }))
  })
})

describe('successGet handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to sign-in when session data is missing', async () => {
    const request = makeRequest({ metadata: null, statusUrl: null })
    const h = makeH()

    await successGet.handler(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/document-upload/sign-in')
  })

  it('renders success view with file names from form object', async () => {
    const request = makeRequest({
      metadata: { reference: 'REF-001' },
      statusUrl: 'http://op/status/1',
      submissionId: 'sub-1',
      uploadedFiles: ['fallback.pdf']
    })
    const h = makeH()

    getUploadStatus.mockResolvedValue({
      data: {
        uploadStatus: UPLOAD_STATUS.SUCCESS,
        form: {
          'file.pdf': { fileStatus: 'accepted', hasError: false }
        }
      }
    })

    await successGet.handler(request, h)

    expect(h.view).toHaveBeenCalledWith('document-upload/success', expect.objectContaining({
      uploadStatus: UPLOAD_STATUS.SUCCESS,
      uploadedFiles: ['file.pdf'],
      numberOfFiles: 1
    }))
  })

  it('falls back to session uploadedFiles when form is empty', async () => {
    const request = makeRequest({
      metadata: { reference: 'REF-001' },
      statusUrl: 'http://op/status/1',
      submissionId: 'sub-1',
      uploadedFiles: ['session-file.pdf']
    })
    const h = makeH()

    getUploadStatus.mockResolvedValue({
      data: {
        uploadStatus: UPLOAD_STATUS.SUCCESS,
        form: {}
      }
    })

    await successGet.handler(request, h)

    expect(h.view).toHaveBeenCalledWith('document-upload/success', expect.objectContaining({
      uploadedFiles: ['session-file.pdf']
    }))
  })

  it('redirects to processing when status is pending', async () => {
    const request = makeRequest({
      metadata: { reference: 'REF-001' },
      statusUrl: 'http://op/status/1',
      submissionId: 'sub-1'
    })
    const h = makeH()

    getUploadStatus.mockResolvedValue({ data: { uploadStatus: UPLOAD_STATUS.PENDING } })

    await successGet.handler(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/document-upload/processing')
  })

  it('renders success view with session fallback data when getUploadStatus throws', async () => {
    const request = makeRequest({
      metadata: { reference: 'REF-001' },
      statusUrl: 'http://op/status/1',
      submissionId: 'sub-1',
      uploadedFiles: ['file.pdf']
    })
    const h = makeH()

    getUploadStatus.mockRejectedValue(new Error('network error'))

    await successGet.handler(request, h)

    expect(h.view).toHaveBeenCalledWith('document-upload/success', expect.objectContaining({
      pageTitle: 'Upload successful',
      uploadStatus: 'completed'
    }))
  })
})
