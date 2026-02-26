import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest'
import { initiateUpload, getUploadStatus, getMetadataBySbi } from '../../../../src/common/helpers/object-processor.js'

// Mock dependencies
vi.mock('../../../../src/config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'objectProcessor.host') return 'https://api.example.com'
      return null
    })
  }
}))

vi.mock('../../../../src/common/helpers/cognito.js', () => ({
  getAccessToken: vi.fn()
}))

vi.mock('../../../../src/common/helpers/logging/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn()
  }))
}))

const { config } = await import('../../../../src/config/config.js')
const { getAccessToken } = await import('../../../../src/common/helpers/cognito.js')

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Object Processor Helper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    config.get.mockImplementation((key) => {
      if (key === 'objectProcessor.host') return 'https://api.example.com'
      return null
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initiateUpload', () => {
    test('should successfully initiate upload with authentication', async () => {
      const mockMetadata = {
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
      }

      const mockResponse = {
        uploadUrl: 'https://upload.example.com/upload',
        statusUrl: 'https://status.example.com/status/123',
        uploadId: 'upload-123',
        correlationId: 'corr-123'
      }

      getAccessToken.mockResolvedValue('mock-access-token')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const result = await initiateUpload(mockMetadata)

      expect(getAccessToken).toHaveBeenCalled()
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/initiate',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-access-token'
          },
          body: JSON.stringify({ metadata: mockMetadata })
        })
      )
      expect(result).toEqual(mockResponse)
    })

    test('should successfully initiate upload without authentication when Cognito is disabled', async () => {
      const mockMetadata = {
        sbi: 123456789,
        submissionId: 'test-uuid-1234'
      }

      const mockResponse = {
        uploadUrl: 'https://upload.example.com/upload',
        statusUrl: 'https://status.example.com/status/123'
      }

      getAccessToken.mockResolvedValue(null)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const result = await initiateUpload(mockMetadata)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/initiate',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
      )
      expect(result).toEqual(mockResponse)
    })

    test('should throw error when API returns non-OK status', async () => {
      const mockMetadata = { sbi: 123456789 }

      getAccessToken.mockResolvedValue('mock-token')
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad Request: Invalid metadata'
      })

      await expect(initiateUpload(mockMetadata)).rejects.toThrow(
        'Object processor API error: 400 Bad Request: Invalid metadata'
      )
    })

    test('should handle 401 unauthorized responses', async () => {
      const mockMetadata = { sbi: 123456789 }

      getAccessToken.mockResolvedValue('invalid-token')
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      })

      await expect(initiateUpload(mockMetadata)).rejects.toThrow(
        'Object processor API error: 401 Unauthorized'
      )
    })

    test('should handle 500 server errors', async () => {
      const mockMetadata = { sbi: 123456789 }

      getAccessToken.mockResolvedValue('mock-token')
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      })

      await expect(initiateUpload(mockMetadata)).rejects.toThrow(
        'Object processor API error: 500 Internal Server Error'
      )
    })

    test('should handle network errors', async () => {
      const mockMetadata = { sbi: 123456789 }

      getAccessToken.mockResolvedValue('mock-token')
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(initiateUpload(mockMetadata)).rejects.toThrow('Network error')
    })
  })

  describe('getUploadStatus', () => {
    test('should successfully get upload status with authentication', async () => {
      const statusUrl = 'https://status.example.com/status/123'
      const mockStatus = {
        status: 'SUCCESSFUL',
        uploadStatus: 'completed',
        numberOfFiles: 3,
        message: 'Upload completed successfully'
      }

      getAccessToken.mockResolvedValue('mock-access-token')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockStatus
      })

      const result = await getUploadStatus(statusUrl)

      expect(getAccessToken).toHaveBeenCalled()
      expect(mockFetch).toHaveBeenCalledWith(
        statusUrl,
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-access-token'
          }
        })
      )
      expect(result).toEqual(mockStatus)
    })

    test('should successfully get upload status without authentication when Cognito is disabled', async () => {
      const statusUrl = 'https://status.example.com/status/123'
      const mockStatus = {
        status: 'SCANNING',
        uploadStatus: 'scanning'
      }

      getAccessToken.mockResolvedValue(null)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockStatus
      })

      const result = await getUploadStatus(statusUrl)

      expect(mockFetch).toHaveBeenCalledWith(
        statusUrl,
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
      )
      expect(result).toEqual(mockStatus)
    })

    test('should handle REJECTED status responses', async () => {
      const statusUrl = 'https://status.example.com/status/123'
      const mockStatus = {
        status: 'REJECTED',
        message: 'File contains virus',
        numberOfRejectedFiles: 2
      }

      getAccessToken.mockResolvedValue('mock-token')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockStatus
      })

      const result = await getUploadStatus(statusUrl)

      expect(result).toEqual(mockStatus)
      expect(result.status).toBe('REJECTED')
    })

    test('should throw error when status check returns non-OK status', async () => {
      const statusUrl = 'https://status.example.com/status/123'

      getAccessToken.mockResolvedValue('mock-token')
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Not Found'
      })

      await expect(getUploadStatus(statusUrl)).rejects.toThrow(
        'Object processor status check error: 404 Not Found'
      )
    })

    test('should handle network errors during status check', async () => {
      const statusUrl = 'https://status.example.com/status/123'

      getAccessToken.mockResolvedValue('mock-token')
      mockFetch.mockRejectedValue(new Error('Connection timeout'))

      await expect(getUploadStatus(statusUrl)).rejects.toThrow('Connection timeout')
    })
  })

  describe('getMetadataBySbi', () => {
    test('should successfully retrieve metadata by SBI with authentication', async () => {
      const sbi = '123456789'
      const mockMetadata = {
        sbi: 123456789,
        submissions: [
          { submissionId: 'sub-1', reference: 'REF-001' },
          { submissionId: 'sub-2', reference: 'REF-002' }
        ]
      }

      getAccessToken.mockResolvedValue('mock-access-token')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockMetadata
      })

      const result = await getMetadataBySbi(sbi)

      expect(getAccessToken).toHaveBeenCalled()
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/metadata/sbi/123456789',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-access-token'
          }
        })
      )
      expect(result).toEqual(mockMetadata)
    })

    test('should successfully retrieve metadata without authentication when Cognito is disabled', async () => {
      const sbi = '123456789'
      const mockMetadata = {
        sbi: 123456789,
        submissions: []
      }

      getAccessToken.mockResolvedValue(null)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockMetadata
      })

      const result = await getMetadataBySbi(sbi)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/metadata/sbi/123456789',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
      )
      expect(result).toEqual(mockMetadata)
    })

    test('should throw error when SBI not found', async () => {
      const sbi = '999999999'

      getAccessToken.mockResolvedValue('mock-token')
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'SBI not found'
      })

      await expect(getMetadataBySbi(sbi)).rejects.toThrow(
        'Object processor API error: 404 SBI not found'
      )
    })

    test('should handle 403 forbidden responses', async () => {
      const sbi = '123456789'

      getAccessToken.mockResolvedValue('mock-token')
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'Forbidden'
      })

      await expect(getMetadataBySbi(sbi)).rejects.toThrow(
        'Object processor API error: 403 Forbidden'
      )
    })

    test('should handle network errors', async () => {
      const sbi = '123456789'

      getAccessToken.mockResolvedValue('mock-token')
      mockFetch.mockRejectedValue(new Error('DNS lookup failed'))

      await expect(getMetadataBySbi(sbi)).rejects.toThrow('DNS lookup failed')
    })
  })

  describe('API Configuration', () => {
    test('should use configured API host from config', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'objectProcessor.host') return 'https://custom-api.example.com'
        return null
      })

      getAccessToken.mockResolvedValue('mock-token')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ uploadUrl: 'test' })
      })

      await initiateUpload({ sbi: 123 })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom-api.example.com/api/v1/initiate',
        expect.any(Object)
      )
    })

    test('should include proper Content-Type header in all requests', async () => {
      getAccessToken.mockResolvedValue(null)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({})
      })

      await initiateUpload({ sbi: 123 })

      const callArgs = mockFetch.mock.calls[0][1]
      expect(callArgs.headers['Content-Type']).toBe('application/json')
    })
  })
})
