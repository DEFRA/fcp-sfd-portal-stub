import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest'
import {
  signInGet,
  signInPost,
  metadataGet,
  metadataPost,
  uploadGet,
  processingGet,
  checkStatusGet,
  errorGet,
  successGet
} from '../../../src/routes/document-upload.js'

// Mock dependencies
vi.mock('../../../src/common/helpers/object-processor.js', () => ({
  initiateUpload: vi.fn(),
  getUploadStatus: vi.fn()
}))

vi.mock('date-fns', () => ({
  format: vi.fn(() => '26/02/2026 10:30:00')
}))

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-1234')
}))

const { initiateUpload, getUploadStatus } = await import('../../../src/common/helpers/object-processor.js')

describe('Document Upload Routes', () => {
  let mockRequest
  let mockToolkit
  let mockYarGet
  let mockYarSet
  let mockLogger

  beforeEach(() => {
    mockYarGet = vi.fn()
    mockYarSet = vi.fn()
    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    mockRequest = {
      payload: {},
      yar: {
        get: mockYarGet,
        set: mockYarSet
      },
      logger: mockLogger
    }

    mockToolkit = {
      view: vi.fn(),
      redirect: vi.fn()
    }

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('signInGet', () => {
    test('should return sign-in view with correct page title', () => {
      signInGet.handler(mockRequest, mockToolkit)

      expect(mockToolkit.view).toHaveBeenCalledWith('document-upload/sign-in', {
        pageTitle: 'Sign in to upload documents'
      })
    })

    test('should have correct method and path', () => {
      expect(signInGet.method).toBe('GET')
      expect(signInGet.path).toBe('/document-upload/sign-in')
    })
  })

  describe('signInPost', () => {
    test('should store CRN in session and redirect to metadata page', () => {
      mockRequest.payload = { crn: '123456789' }

      signInPost.handler(mockRequest, mockToolkit)

      expect(mockYarSet).toHaveBeenCalledWith('crn', '123456789')
      expect(mockToolkit.redirect).toHaveBeenCalledWith('/document-upload/metadata')
    })

    test('should handle different CRN values', () => {
      mockRequest.payload = { crn: '987654321' }

      signInPost.handler(mockRequest, mockToolkit)

      expect(mockYarSet).toHaveBeenCalledWith('crn', '987654321')
      expect(mockToolkit.redirect).toHaveBeenCalledWith('/document-upload/metadata')
    })

    test('should have correct method and path', () => {
      expect(signInPost.method).toBe('POST')
      expect(signInPost.path).toBe('/document-upload/sign-in')
    })
  })

  describe('metadataGet', () => {
    test('should return metadata view when user is signed in', () => {
      mockYarGet.mockReturnValue('123456789')

      metadataGet.handler(mockRequest, mockToolkit)

      expect(mockYarGet).toHaveBeenCalledWith('crn')
      expect(mockToolkit.view).toHaveBeenCalledWith('document-upload/metadata', {
        pageTitle: 'Enter document details',
        crn: '123456789'
      })
    })

    test('should redirect to sign-in when user is not authenticated', () => {
      mockYarGet.mockReturnValue(null)

      metadataGet.handler(mockRequest, mockToolkit)

      expect(mockToolkit.redirect).toHaveBeenCalledWith('/document-upload/sign-in')
    })

    test('should have correct method and path', () => {
      expect(metadataGet.method).toBe('GET')
      expect(metadataGet.path).toBe('/document-upload/metadata')
    })
  })

  describe('metadataPost', () => {
    beforeEach(() => {
      mockRequest.payload = {
        sbi: '123456789',
        crn: '987654321',
        frn: '1234567890',
        reference: 'REF-2026-001',
        type: 'Invoice',
        service: 'SFI'
      }
    })

    test('should successfully initiate upload and store session data', async () => {
      const mockInitiateResult = {
        uploadUrl: 'https://upload.example.com/upload',
        statusUrl: 'https://status.example.com/status/123',
        uploadId: 'upload-123',
        correlationId: 'corr-123'
      }
      initiateUpload.mockResolvedValue(mockInitiateResult)

      await metadataPost.handler(mockRequest, mockToolkit)

      expect(initiateUpload).toHaveBeenCalledWith({
        sbi: 123456789,
        crn: 987654321,
        frn: 1234567890,
        submissionId: 'test-uuid-1234',
        uosr: '123456789_test-uuid-1234',
        submissionDateTime: '26/02/2026 10:30:00',
        files: ['document.pdf'],
        filesInSubmission: 1,
        type: 'Invoice',
        reference: 'REF-2026-001',
        service: 'SFI'
      }, '/document-upload/processing')

      expect(mockYarSet).toHaveBeenCalledWith('metadata', expect.objectContaining({
        sbi: 123456789,
        crn: 987654321,
        frn: 1234567890,
        reference: 'REF-2026-001'
      }))
      expect(mockYarSet).toHaveBeenCalledWith('submissionId', 'test-uuid-1234')
      // In gateway-routing mode (default), uploadUrl is transformed to use gateway domain
      expect(mockYarSet).toHaveBeenCalledWith('uploadUrl', 'http://localhost:3019/upload-and-scan/upload-123')
      expect(mockYarSet).toHaveBeenCalledWith('statusUrl', mockInitiateResult.statusUrl)
      expect(mockYarSet).toHaveBeenCalledWith('uploadId', mockInitiateResult.uploadId)
      expect(mockYarSet).toHaveBeenCalledWith('correlationId', mockInitiateResult.correlationId)
      expect(mockToolkit.redirect).toHaveBeenCalledWith('/document-upload/upload')
    })

    test('should generate correct UOSR format combining SBI and submission ID', async () => {
      const mockInitiateResult = {
        uploadUrl: 'https://upload.example.com',
        statusUrl: 'https://status.example.com',
        uploadId: 'upload-123',
        correlationId: 'corr-123'
      }
      initiateUpload.mockResolvedValue(mockInitiateResult)

      await metadataPost.handler(mockRequest, mockToolkit)

      const capturedMetadata = mockYarSet.mock.calls.find(call => call[0] === 'metadata')[1]
      expect(capturedMetadata.uosr).toBe('123456789_test-uuid-1234')
    })

    test('should convert string numbers to integers for SBI, CRN, and FRN', async () => {
      const mockInitiateResult = {
        uploadUrl: 'https://upload.example.com',
        statusUrl: 'https://status.example.com',
        uploadId: 'upload-123',
        correlationId: 'corr-123'
      }
      initiateUpload.mockResolvedValue(mockInitiateResult)

      await metadataPost.handler(mockRequest, mockToolkit)

      const metadataArg = initiateUpload.mock.calls[0][0]
      expect(metadataArg.sbi).toBe(123456789)
      expect(metadataArg.crn).toBe(987654321)
      expect(metadataArg.frn).toBe(1234567890)
      expect(typeof metadataArg.sbi).toBe('number')
      expect(typeof metadataArg.crn).toBe('number')
      expect(typeof metadataArg.frn).toBe('number')
    })

    test('should handle upload initiation failure and show error', async () => {
      const error = new Error('Network error')
      initiateUpload.mockRejectedValue(error)
      mockYarGet.mockReturnValue('123456789')

      await metadataPost.handler(mockRequest, mockToolkit)

      expect(mockLogger.error).toHaveBeenCalledWith({ error }, 'Failed to initiate upload')
      expect(mockToolkit.view).toHaveBeenCalledWith('document-upload/metadata', {
        pageTitle: 'Enter document details',
        crn: '987654321',
        error: 'Failed to initiate upload. Please try again.'
      })
    })

    test('should handle API timeout errors gracefully', async () => {
      const timeoutError = new Error('Request timeout')
      initiateUpload.mockRejectedValue(timeoutError)
      mockYarGet.mockReturnValue('123456789')

      await metadataPost.handler(mockRequest, mockToolkit)

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockToolkit.view).toHaveBeenCalledWith(
        'document-upload/metadata',
        expect.objectContaining({
          error: 'Failed to initiate upload. Please try again.'
        })
      )
    })

    test('should have correct method and path', () => {
      expect(metadataPost.method).toBe('POST')
      expect(metadataPost.path).toBe('/document-upload/metadata')
    })
  })

  describe('uploadGet', () => {
    test('should return upload view when session has required data', () => {
      const mockMetadata = {
        sbi: 123456789,
        reference: 'REF-2026-001'
      }
      const mockUploadUrl = 'https://upload.example.com/upload'

      mockYarGet.mockImplementation((key) => {
        if (key === 'metadata') return mockMetadata
        if (key === 'uploadUrl') return mockUploadUrl
        return null
      })

      uploadGet.handler(mockRequest, mockToolkit)

      expect(mockToolkit.view).toHaveBeenCalledWith('document-upload/upload', {
        pageTitle: 'Upload files',
        metadata: mockMetadata,
        uploadUrl: mockUploadUrl,
        uploadMode: 'gateway-routing'
      })
    })

    test('should redirect to sign-in when metadata is missing', () => {
      mockYarGet.mockReturnValue(null)

      uploadGet.handler(mockRequest, mockToolkit)

      expect(mockToolkit.redirect).toHaveBeenCalledWith('/document-upload/sign-in')
    })

    test('should redirect to sign-in when uploadUrl is missing', () => {
      mockYarGet.mockImplementation((key) => {
        if (key === 'metadata') return { sbi: 123456789 }
        return null
      })

      uploadGet.handler(mockRequest, mockToolkit)

      expect(mockToolkit.redirect).toHaveBeenCalledWith('/document-upload/sign-in')
    })

    test('should have correct method and path', () => {
      expect(uploadGet.method).toBe('GET')
      expect(uploadGet.path).toBe('/document-upload/upload')
    })
  })

  describe('processingGet', () => {
    test('should return processing view with submission details', () => {
      const mockMetadata = {
        reference: 'REF-2026-001',
        sbi: 123456789
      }
      const mockUploadedFiles = ['document1.pdf', 'document2.pdf']

      mockYarGet.mockImplementation((key) => {
        if (key === 'submissionId') return 'test-uuid-1234'
        if (key === 'metadata') return mockMetadata
        if (key === 'uploadedFiles') return mockUploadedFiles
        return null
      })

      processingGet.handler(mockRequest, mockToolkit)

      expect(mockToolkit.view).toHaveBeenCalledWith('document-upload/processing', {
        pageTitle: 'Processing your upload',
        submissionId: 'test-uuid-1234',
        reference: 'REF-2026-001',
        numberOfFiles: 2,
        uploadedFiles: mockUploadedFiles,
        uploadStatus: 'scanning'
      })
    })

    test('should handle no uploaded files', () => {
      mockYarGet.mockImplementation((key) => {
        if (key === 'submissionId') return 'test-uuid-1234'
        if (key === 'metadata') return { reference: 'REF-2026-001' }
        return null
      })

      processingGet.handler(mockRequest, mockToolkit)

      expect(mockToolkit.view).toHaveBeenCalledWith('document-upload/processing', {
        pageTitle: 'Processing your upload',
        submissionId: 'test-uuid-1234',
        reference: 'REF-2026-001',
        numberOfFiles: 0,
        uploadedFiles: [],
        uploadStatus: 'scanning'
      })
    })

    test('should redirect to sign-in when submissionId is missing', () => {
      mockYarGet.mockImplementation((key) => {
        if (key === 'metadata') return { reference: 'REF-2026-001' }
        return null
      })

      processingGet.handler(mockRequest, mockToolkit)

      expect(mockToolkit.redirect).toHaveBeenCalledWith('/document-upload/sign-in')
    })

    test('should redirect to sign-in when metadata is missing', () => {
      mockYarGet.mockImplementation((key) => {
        if (key === 'submissionId') return 'test-uuid-1234'
        return null
      })

      processingGet.handler(mockRequest, mockToolkit)

      expect(mockToolkit.redirect).toHaveBeenCalledWith('/document-upload/sign-in')
    })

    test('should have correct method and path', () => {
      expect(processingGet.method).toBe('GET')
      expect(processingGet.path).toBe('/document-upload/processing')
    })
  })

  describe('checkStatusGet', () => {
    beforeEach(() => {
      mockYarGet.mockImplementation((key) => {
        if (key === 'statusUrl') return 'https://status.example.com/status/123'
        if (key === 'metadata') return { reference: 'REF-2026-001' }
        return null
      })
    })

    test('should redirect to success page when upload is SUCCESSFUL', async () => {
      getUploadStatus.mockResolvedValue({
        status: 'SUCCESSFUL',
        uploadStatus: 'completed'
      })

      await checkStatusGet.handler(mockRequest, mockToolkit)

      expect(getUploadStatus).toHaveBeenCalledWith('https://status.example.com/status/123')
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          statusUrl: 'https://status.example.com/status/123',
          status: 'completed'
        },
        'Checked upload status'
      )
      expect(mockToolkit.redirect).toHaveBeenCalledWith('/document-upload/success')
    })

    test('should redirect to error page when upload is REJECTED', async () => {
      getUploadStatus.mockResolvedValue({
        status: 'REJECTED',
        message: 'File contains virus',
        numberOfRejectedFiles: 2
      })

      await checkStatusGet.handler(mockRequest, mockToolkit)

      expect(mockYarSet).toHaveBeenCalledWith('rejectionReason', 'File contains virus')
      expect(mockYarSet).toHaveBeenCalledWith('numberOfRejectedFiles', 2)
      expect(mockToolkit.redirect).toHaveBeenCalledWith('/document-upload/error')
    })

    test('should redirect to processing page when upload is still in progress', async () => {
      getUploadStatus.mockResolvedValue({
        status: 'SCANNING',
        uploadStatus: 'scanning'
      })

      await checkStatusGet.handler(mockRequest, mockToolkit)

      expect(mockToolkit.redirect).toHaveBeenCalledWith('/document-upload/processing')
    })

    test('should handle different pending statuses appropriately', async () => {
      const pendingStatuses = ['SCANNING', 'PROCESSING', 'PENDING', 'QUEUED']

      for (const status of pendingStatuses) {
        vi.clearAllMocks()
        getUploadStatus.mockResolvedValue({ status })

        await checkStatusGet.handler(mockRequest, mockToolkit)

        expect(mockToolkit.redirect).toHaveBeenCalledWith('/document-upload/processing')
      }
    })

    test('should redirect to sign-in when statusUrl is missing', async () => {
      mockYarGet.mockImplementation((key) => {
        if (key === 'metadata') return { reference: 'REF-2026-001' }
        return null
      })

      await checkStatusGet.handler(mockRequest, mockToolkit)

      expect(mockToolkit.redirect).toHaveBeenCalledWith('/document-upload/sign-in')
      expect(getUploadStatus).not.toHaveBeenCalled()
    })

    test('should redirect to sign-in when metadata is missing', async () => {
      mockYarGet.mockImplementation((key) => {
        if (key === 'statusUrl') return 'https://status.example.com/status/123'
        return null
      })

      await checkStatusGet.handler(mockRequest, mockToolkit)

      expect(mockToolkit.redirect).toHaveBeenCalledWith('/document-upload/sign-in')
      expect(getUploadStatus).not.toHaveBeenCalled()
    })

    test('should handle status check API failures gracefully', async () => {
      const apiError = new Error('API is down')
      getUploadStatus.mockRejectedValue(apiError)

      await checkStatusGet.handler(mockRequest, mockToolkit)

      expect(mockLogger.error).toHaveBeenCalledWith({ error: apiError }, 'Failed to check upload status')
      expect(mockToolkit.redirect).toHaveBeenCalledWith('/document-upload/processing')
    })

    test('should have correct method and path', () => {
      expect(checkStatusGet.method).toBe('GET')
      expect(checkStatusGet.path).toBe('/document-upload/check-status')
    })
  })

  describe('errorGet', () => {
    test('should return error view with rejection details', () => {
      const mockMetadata = { reference: 'REF-2026-001' }
      const mockUploadedFiles = ['doc1.pdf', 'doc2.pdf', 'doc3.pdf']

      mockYarGet.mockImplementation((key) => {
        if (key === 'submissionId') return 'test-uuid-1234'
        if (key === 'metadata') return mockMetadata
        if (key === 'uploadedFiles') return mockUploadedFiles
        if (key === 'numberOfRejectedFiles') return 2
        return null
      })

      errorGet.handler(mockRequest, mockToolkit)

      expect(mockToolkit.view).toHaveBeenCalledWith('document-upload/error', {
        pageTitle: 'Upload failed',
        submissionId: 'test-uuid-1234',
        reference: 'REF-2026-001',
        numberOfFiles: 3,
        numberOfRejectedFiles: 2,
        uploadedFiles: mockUploadedFiles
      })
    })

    test('should use default rejected file count when not specified', () => {
      const mockUploadedFiles = ['doc1.pdf', 'doc2.pdf']

      mockYarGet.mockImplementation((key) => {
        if (key === 'submissionId') return 'test-uuid-1234'
        if (key === 'metadata') return { reference: 'REF-2026-001' }
        if (key === 'uploadedFiles') return mockUploadedFiles
        return null
      })

      errorGet.handler(mockRequest, mockToolkit)

      expect(mockToolkit.view).toHaveBeenCalledWith('document-upload/error', {
        pageTitle: 'Upload failed',
        submissionId: 'test-uuid-1234',
        reference: 'REF-2026-001',
        numberOfFiles: 2,
        numberOfRejectedFiles: 2,
        uploadedFiles: mockUploadedFiles
      })
    })

    test('should redirect to sign-in when submissionId is missing', () => {
      mockYarGet.mockImplementation((key) => {
        if (key === 'metadata') return { reference: 'REF-2026-001' }
        return null
      })

      errorGet.handler(mockRequest, mockToolkit)

      expect(mockToolkit.redirect).toHaveBeenCalledWith('/document-upload/sign-in')
    })

    test('should redirect to sign-in when metadata is missing', () => {
      mockYarGet.mockImplementation((key) => {
        if (key === 'submissionId') return 'test-uuid-1234'
        return null
      })

      errorGet.handler(mockRequest, mockToolkit)

      expect(mockToolkit.redirect).toHaveBeenCalledWith('/document-upload/sign-in')
    })

    test('should have correct method and path', () => {
      expect(errorGet.method).toBe('GET')
      expect(errorGet.path).toBe('/document-upload/error')
    })
  })

  describe('successGet', () => {
    beforeEach(() => {
      mockYarGet.mockImplementation((key) => {
        if (key === 'submissionId') return 'test-uuid-1234'
        if (key === 'statusUrl') return 'https://status.example.com/status/123'
        if (key === 'metadata') return { reference: 'REF-2026-001' }
        if (key === 'uploadedFiles') return ['doc1.pdf']
        return null
      })
    })

    test('should return success view when upload status is SUCCESSFUL', async () => {
      getUploadStatus.mockResolvedValue({
        status: 'SUCCESSFUL',
        numberOfFiles: 3,
        fileNames: ['doc1.pdf']
      })

      await successGet.handler(mockRequest, mockToolkit)

      expect(mockToolkit.view).toHaveBeenCalledWith('document-upload/success', {
        pageTitle: 'Upload successful',
        submissionId: 'test-uuid-1234',
        reference: 'REF-2026-001',
        uploadStatus: 'SUCCESSFUL',
        numberOfFiles: 3,
        uploadedFiles: ['doc1.pdf']
      })
    })

    test('should use session file count when API does not return numberOfFiles', async () => {
      mockYarGet.mockImplementation((key) => {
        if (key === 'submissionId') return 'test-uuid-1234'
        if (key === 'statusUrl') return 'https://status.example.com/status/123'
        if (key === 'metadata') return { reference: 'REF-2026-001' }
        if (key === 'uploadedFiles') return ['doc1.pdf', 'doc2.pdf']
        return null
      })

      getUploadStatus.mockResolvedValue({
        status: 'SUCCESSFUL'
      })

      await successGet.handler(mockRequest, mockToolkit)

      expect(mockToolkit.view).toHaveBeenCalledWith('document-upload/success', {
        pageTitle: 'Upload successful',
        submissionId: 'test-uuid-1234',
        reference: 'REF-2026-001',
        uploadStatus: 'SUCCESSFUL',
        numberOfFiles: 2,
        uploadedFiles: ['doc1.pdf', 'doc2.pdf']
      })
    })

    test('should redirect to error page when status is REJECTED', async () => {
      getUploadStatus.mockResolvedValue({
        status: 'REJECTED',
        message: 'Virus detected',
        numberOfRejectedFiles: 1
      })

      await successGet.handler(mockRequest, mockToolkit)

      expect(mockYarSet).toHaveBeenCalledWith('rejectionReason', 'Virus detected')
      expect(mockYarSet).toHaveBeenCalledWith('numberOfRejectedFiles', 1)
      expect(mockToolkit.redirect).toHaveBeenCalledWith('/document-upload/error')
    })

    test('should redirect to processing page when status is still processing', async () => {
      getUploadStatus.mockResolvedValue({
        status: 'SCANNING',
        uploadStatus: 'scanning'
      })

      await successGet.handler(mockRequest, mockToolkit)

      expect(mockToolkit.redirect).toHaveBeenCalledWith('/document-upload/processing')
    })

    test('should handle API errors and display success page with session data', async () => {
      const apiError = new Error('API unavailable')
      getUploadStatus.mockRejectedValue(apiError)

      await successGet.handler(mockRequest, mockToolkit)

      expect(mockLogger.error).toHaveBeenCalledWith({ error: apiError }, 'Failed to get upload status')
      expect(mockToolkit.view).toHaveBeenCalledWith('document-upload/success', {
        pageTitle: 'Upload successful',
        submissionId: 'test-uuid-1234',
        reference: 'REF-2026-001',
        uploadStatus: 'completed',
        numberOfFiles: 1,
        uploadedFiles: ['doc1.pdf']
      })
    })

    test('should redirect to sign-in when metadata is missing', async () => {
      mockYarGet.mockImplementation((key) => {
        if (key === 'statusUrl') return 'https://status.example.com/status/123'
        return null
      })

      await successGet.handler(mockRequest, mockToolkit)

      expect(mockToolkit.redirect).toHaveBeenCalledWith('/document-upload/sign-in')
      expect(getUploadStatus).not.toHaveBeenCalled()
    })

    test('should redirect to sign-in when statusUrl is missing', async () => {
      mockYarGet.mockImplementation((key) => {
        if (key === 'metadata') return { reference: 'REF-2026-001' }
        return null
      })

      await successGet.handler(mockRequest, mockToolkit)

      expect(mockToolkit.redirect).toHaveBeenCalledWith('/document-upload/sign-in')
      expect(getUploadStatus).not.toHaveBeenCalled()
    })

    test('should have correct method and path', () => {
      expect(successGet.method).toBe('GET')
      expect(successGet.path).toBe('/document-upload/success')
    })
  })
})
