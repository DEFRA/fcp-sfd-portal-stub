import { describe, it, expect, vi, beforeEach } from 'vitest'
import { initiateUpload, getUploadStatus } from '../../../../src/common/helpers/object-processor.js'
import { UPLOAD_STATUS } from '../../../../src/common/constants/upload-status.js'

vi.mock('../../../../src/config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'objectProcessor.host') return 'http://object-processor:3021'
      return null
    })
  }
}))

vi.mock('../../../../src/common/helpers/cognito.js', () => ({
  getAccessToken: vi.fn().mockResolvedValue(null)
}))

vi.mock('../../../../src/common/helpers/logging/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn()
  }))
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('object-processor helper', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe('initiateUpload', () => {
    it('posts metadata and redirect to the initiate endpoint', async () => {
      const uploadId = 'upload-123'
      const uploadUrl = 'http://cdp-uploader:7337/upload-and-scan/upload-123'
      const statusUrl = '/api/v1/uploader/status/upload-123'

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { uploadId, uploadUrl, statusUrl }
        })
      })

      const metadata = { submissionId: 'sub-1', sbi: 123 }
      const result = await initiateUpload(metadata, '/redirect-path')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://object-processor:3021/api/v1/uploader/initiate',
        expect.objectContaining({ method: 'POST' })
      )
      expect(result.uploadId).toBe(uploadId)
      expect(result.uploadUrl).toBe(uploadUrl)
      expect(result.correlationId).toBe(uploadId)
    })

    it('prepends host to relative statusUrl', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            uploadId: 'upload-123',
            uploadUrl: 'http://cdp-uploader:7337/upload-and-scan/upload-123',
            statusUrl: '/api/v1/uploader/status/upload-123'
          }
        })
      })

      const result = await initiateUpload({ submissionId: 'sub-1' }, '/redirect')

      expect(result.statusUrl).toBe('http://object-processor:3021/api/v1/uploader/status/upload-123')
    })

    it('uses absolute statusUrl as-is when already absolute', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            uploadId: 'upload-123',
            uploadUrl: 'http://cdp-uploader:7337/upload-and-scan/upload-123',
            statusUrl: 'http://other-host:3021/api/v1/uploader/status/upload-123'
          }
        })
      })

      const result = await initiateUpload({ submissionId: 'sub-1' }, '/redirect')

      expect(result.statusUrl).toBe('http://other-host:3021/api/v1/uploader/status/upload-123')
    })

    it('includes Bearer token in Authorization header when token is available', async () => {
      const { getAccessToken } = await import('../../../../src/common/helpers/cognito.js')
      getAccessToken.mockResolvedValueOnce('my-token')

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { uploadId: 'x', uploadUrl: 'http://u/upload-and-scan/x', statusUrl: '/status/x' }
        })
      })

      await initiateUpload({ submissionId: 'sub-1' }, '/redirect')

      const [, options] = mockFetch.mock.calls[0]
      expect(options.headers.Authorization).toBe('Bearer my-token')
    })

    it('throws when API responds with an error status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      })

      await expect(initiateUpload({ submissionId: 'sub-1' }, '/redirect'))
        .rejects
        .toThrow('Object processor API error: 500')
    })
  })

  describe('getUploadStatus', () => {
    it('returns the full response from the status URL', async () => {
      const statusResponse = {
        data: {
          uploadStatus: UPLOAD_STATUS.READY,
          metadata: { sbi: 123 },
          numberOfFiles: 1,
          fileNames: ['doc.pdf']
        }
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => statusResponse
      })

      const result = await getUploadStatus('http://object-processor:3021/api/v1/uploader/status/upload-123')

      expect(result).toEqual(statusResponse)
      expect(result.data.uploadStatus).toBe(UPLOAD_STATUS.READY)
    })

    it('returns initiated status when upload is newly created', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { uploadStatus: UPLOAD_STATUS.INITIATED } })
      })

      const result = await getUploadStatus('http://object-processor:3021/api/v1/uploader/status/upload-123')

      expect(result.data.uploadStatus).toBe(UPLOAD_STATUS.INITIATED)
    })

    it('returns pending status when upload is being scanned', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { uploadStatus: UPLOAD_STATUS.PENDING } })
      })

      const result = await getUploadStatus('http://object-processor:3021/api/v1/uploader/status/upload-123')

      expect(result.data.uploadStatus).toBe(UPLOAD_STATUS.PENDING)
    })

    it('throws when status check responds with an error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Not Found'
      })

      await expect(getUploadStatus('http://object-processor:3021/api/v1/uploader/status/missing'))
        .rejects
        .toThrow('Object processor status check error: 404')
    })
  })
})
