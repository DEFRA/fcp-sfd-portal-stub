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

const { checkStatusGet, successGet } = await import('../../../src/routes/document-upload.js')
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

  it('redirects to success when status is ready', async () => {
    const request = makeRequest({ metadata: { sbi: 1 }, statusUrl: 'http://op/status/1' })
    const h = makeH()

    getUploadStatus.mockResolvedValue({ data: { uploadStatus: UPLOAD_STATUS.READY } })

    await checkStatusGet.handler(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/document-upload/success')
  })

  it('redirects to processing when status is initiated', async () => {
    const request = makeRequest({ metadata: { sbi: 1 }, statusUrl: 'http://op/status/1' })
    const h = makeH()

    getUploadStatus.mockResolvedValue({ data: { uploadStatus: UPLOAD_STATUS.INITIATED } })

    await checkStatusGet.handler(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/document-upload/processing')
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

  it('renders success view when status is ready', async () => {
    const request = makeRequest({
      metadata: { reference: 'REF-001' },
      statusUrl: 'http://op/status/1',
      submissionId: 'sub-1',
      uploadedFiles: ['file.pdf']
    })
    const h = makeH()

    getUploadStatus.mockResolvedValue({
      data: {
        uploadStatus: UPLOAD_STATUS.READY,
        numberOfFiles: 1,
        fileNames: ['file.pdf']
      }
    })

    await successGet.handler(request, h)

    expect(h.view).toHaveBeenCalledWith('document-upload/success', expect.objectContaining({
      uploadStatus: UPLOAD_STATUS.READY
    }))
  })

  it('redirects to processing when status is initiated', async () => {
    const request = makeRequest({
      metadata: { reference: 'REF-001' },
      statusUrl: 'http://op/status/1',
      submissionId: 'sub-1'
    })
    const h = makeH()

    getUploadStatus.mockResolvedValue({ data: { uploadStatus: UPLOAD_STATUS.INITIATED } })

    await successGet.handler(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/document-upload/processing')
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
