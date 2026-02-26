import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest'
import { getAccessToken, clearCachedToken } from '../../../../src/common/helpers/cognito.js'

// Mock dependencies
vi.mock('../../../../src/config/config.js', () => ({
  config: {
    get: vi.fn()
  }
}))

vi.mock('../../../../src/common/helpers/logging/logger.js', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn()
  }))
}))

const { config } = await import('../../../../src/config/config.js')

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Cognito Helper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearCachedToken()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-26T10:00:00Z'))
  })

  afterEach(() => {
    vi.clearAllMocks()
    clearCachedToken()
    vi.useRealTimers()
  })

  describe('getAccessToken', () => {
    test('should return null when Cognito is disabled', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'cognito.enabled') return false
        return null
      })

      const token = await getAccessToken()

      expect(token).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    test('should successfully obtain access token', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'cognito.enabled') return true
        if (key === 'cognito.domain') return 'auth.example.com'
        if (key === 'cognito.clientId') return 'test-client-id'
        if (key === 'cognito.clientSecret') return 'test-client-secret'
        return null
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'mock-access-token-123',
          token_type: 'Bearer',
          expires_in: 3600
        })
      })

      const token = await getAccessToken()

      expect(token).toBe('mock-access-token-123')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://auth.example.com/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: expect.stringContaining('Basic ')
          },
          body: 'grant_type=client_credentials'
        })
      )
    })

    test('should use Basic Auth with base64 encoded credentials', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'cognito.enabled') return true
        if (key === 'cognito.domain') return 'auth.example.com'
        if (key === 'cognito.clientId') return 'my-client-id'
        if (key === 'cognito.clientSecret') return 'my-client-secret'
        return null
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 3600
        })
      })

      await getAccessToken()

      const expectedCredentials = Buffer.from('my-client-id:my-client-secret').toString('base64')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Basic ${expectedCredentials}`
          })
        })
      )
    })

    test('should cache token and reuse it within validity period', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'cognito.enabled') return true
        if (key === 'cognito.domain') return 'auth.example.com'
        if (key === 'cognito.clientId') return 'client-id'
        if (key === 'cognito.clientSecret') return 'client-secret'
        return null
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'cached-token',
          expires_in: 3600
        })
      })

      const token1 = await getAccessToken()
      const token2 = await getAccessToken()
      const token3 = await getAccessToken()

      expect(token1).toBe('cached-token')
      expect(token2).toBe('cached-token')
      expect(token3).toBe('cached-token')
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    test('should refresh token when it expires (with 5 minute buffer)', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'cognito.enabled') return true
        if (key === 'cognito.domain') return 'auth.example.com'
        if (key === 'cognito.clientId') return 'client-id'
        if (key === 'cognito.clientSecret') return 'client-secret'
        return null
      })

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'first-token',
            expires_in: 600 // 10 minutes
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'second-token',
            expires_in: 3600
          })
        })

      const token1 = await getAccessToken()
      expect(token1).toBe('first-token')

      // Advance time by 6 minutes (past the 5 minute buffer)
      vi.advanceTimersByTime(6 * 60 * 1000)

      const token2 = await getAccessToken()
      expect(token2).toBe('second-token')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    test('should not refresh token if still within buffer period', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'cognito.enabled') return true
        if (key === 'cognito.domain') return 'auth.example.com'
        if (key === 'cognito.clientId') return 'client-id'
        if (key === 'cognito.clientSecret') return 'client-secret'
        return null
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'valid-token',
          expires_in: 600 // 10 minutes
        })
      })

      const token1 = await getAccessToken()

      // Advance time by 4 minutes (still within 5 minute buffer)
      vi.advanceTimersByTime(4 * 60 * 1000)

      const token2 = await getAccessToken()

      expect(token1).toBe('valid-token')
      expect(token2).toBe('valid-token')
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    test('should throw error when domain is missing', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'cognito.enabled') return true
        if (key === 'cognito.domain') return null
        if (key === 'cognito.clientId') return 'client-id'
        if (key === 'cognito.clientSecret') return 'client-secret'
        return null
      })

      await expect(getAccessToken()).rejects.toThrow(
        'COGNITO_DOMAIN is required when COGNITO_ENABLED=true'
      )
    })

    test('should throw error when clientId is missing', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'cognito.enabled') return true
        if (key === 'cognito.domain') return 'auth.example.com'
        if (key === 'cognito.clientId') return null
        if (key === 'cognito.clientSecret') return 'client-secret'
        return null
      })

      await expect(getAccessToken()).rejects.toThrow(
        'COGNITO_CLIENT_ID is required when COGNITO_ENABLED=true'
      )
    })

    test('should throw error when clientSecret is missing', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'cognito.enabled') return true
        if (key === 'cognito.domain') return 'auth.example.com'
        if (key === 'cognito.clientId') return 'client-id'
        if (key === 'cognito.clientSecret') return null
        return null
      })

      await expect(getAccessToken()).rejects.toThrow(
        'COGNITO_CLIENT_SECRET is required when COGNITO_ENABLED=true'
      )
    })

    test('should throw error when Cognito returns 401 unauthorized', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'cognito.enabled') return true
        if (key === 'cognito.domain') return 'auth.example.com'
        if (key === 'cognito.clientId') return 'client-id'
        if (key === 'cognito.clientSecret') return 'wrong-secret'
        return null
      })

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Invalid credentials'
      })

      await expect(getAccessToken()).rejects.toThrow(
        'Cognito authentication failed: 401 Invalid credentials'
      )
    })

    test('should throw error when Cognito returns 400 bad request', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'cognito.enabled') return true
        if (key === 'cognito.domain') return 'auth.example.com'
        if (key === 'cognito.clientId') return 'client-id'
        if (key === 'cognito.clientSecret') return 'client-secret'
        return null
      })

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid grant type'
      })

      await expect(getAccessToken()).rejects.toThrow(
        'Cognito authentication failed: 400 Invalid grant type'
      )
    })

    test('should throw error when Cognito returns 500 server error', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'cognito.enabled') return true
        if (key === 'cognito.domain') return 'auth.example.com'
        if (key === 'cognito.clientId') return 'client-id'
        if (key === 'cognito.clientSecret') return 'client-secret'
        return null
      })

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      })

      await expect(getAccessToken()).rejects.toThrow(
        'Cognito authentication failed: 500 Internal Server Error'
      )
    })

    test('should handle network errors', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'cognito.enabled') return true
        if (key === 'cognito.domain') return 'auth.example.com'
        if (key === 'cognito.clientId') return 'client-id'
        if (key === 'cognito.clientSecret') return 'client-secret'
        return null
      })

      mockFetch.mockRejectedValue(new Error('Network connection failed'))

      await expect(getAccessToken()).rejects.toThrow('Network connection failed')
    })

    test('should use correct OAuth2 endpoint', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'cognito.enabled') return true
        if (key === 'cognito.domain') return 'custom-auth.example.com'
        if (key === 'cognito.clientId') return 'client-id'
        if (key === 'cognito.clientSecret') return 'client-secret'
        return null
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 3600
        })
      })

      await getAccessToken()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom-auth.example.com/oauth2/token',
        expect.any(Object)
      )
    })

    test('should use client_credentials grant type', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'cognito.enabled') return true
        if (key === 'cognito.domain') return 'auth.example.com'
        if (key === 'cognito.clientId') return 'client-id'
        if (key === 'cognito.clientSecret') return 'client-secret'
        return null
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 3600
        })
      })

      await getAccessToken()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: 'grant_type=client_credentials'
        })
      )
    })
  })

  describe('clearCachedToken', () => {
    test('should clear cached token', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'cognito.enabled') return true
        if (key === 'cognito.domain') return 'auth.example.com'
        if (key === 'cognito.clientId') return 'client-id'
        if (key === 'cognito.clientSecret') return 'client-secret'
        return null
      })

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'first-token',
            expires_in: 3600
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'second-token',
            expires_in: 3600
          })
        })

      const token1 = await getAccessToken()
      expect(token1).toBe('first-token')

      clearCachedToken()

      const token2 = await getAccessToken()
      expect(token2).toBe('second-token')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    test('should allow new token to be cached after clearing', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'cognito.enabled') return true
        if (key === 'cognito.domain') return 'auth.example.com'
        if (key === 'cognito.clientId') return 'client-id'
        if (key === 'cognito.clientSecret') return 'client-secret'
        return null
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-token',
          expires_in: 3600
        })
      })

      clearCachedToken()

      const token1 = await getAccessToken()
      const token2 = await getAccessToken()

      expect(token1).toBe('new-token')
      expect(token2).toBe('new-token')
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Token Expiry Logic', () => {
    test('should calculate correct expiry time from expires_in', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'cognito.enabled') return true
        if (key === 'cognito.domain') return 'auth.example.com'
        if (key === 'cognito.clientId') return 'client-id'
        if (key === 'cognito.clientSecret') return 'client-secret'
        return null
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 7200 // 2 hours
        })
      })

      await getAccessToken()

      // Advance by 1 hour 54 minutes (6 minutes before expiry, within buffer)
      vi.advanceTimersByTime(114 * 60 * 1000)
      await getAccessToken()

      // Should still use cached token
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Advance by another 2 minutes (now past buffer)
      vi.advanceTimersByTime(2 * 60 * 1000)

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-token',
          expires_in: 3600
        })
      })

      await getAccessToken()

      // Should have fetched a new token
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })
})
