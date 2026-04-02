import { config } from '../../config/config.js'
import { getAccessToken } from './cognito.js'
import { createLogger } from './logging/logger.js'

const logger = createLogger()

async function makeRequest (path, options = {}) {
  const host = config.get('objectProcessor.host')
  const token = await getAccessToken()

  const url = `${host}${path}`

  logger.info({ url, method: options.method || 'GET', hasAuth: !!token }, 'Calling object processor API')

  const headers = {
    ...options.headers,
    'Content-Type': 'application/json'
  }

  // Only add Authorization header if token exists (Cognito enabled)
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(url, {
    ...options,
    headers
  })

  if (!response.ok) {
    const errorText = await response.text()
    logger.error({ status: response.status, url, error: errorText }, 'Object processor API request failed')
    throw new Error(`Object processor API error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  logger.info({ url }, 'Object processor API request successful')

  return data
}

export async function initiateUpload (metadata, redirect) {
  logger.info({ submissionId: metadata.submissionId }, 'Initiating upload with object processor')

  const payload = {
    metadata,
    redirect
  }

  const result = await makeRequest('/api/v1/uploader/initiate', {
    method: 'POST',
    body: JSON.stringify(payload)
  })

  const { uploadId, uploadUrl, statusUrl } = result.data
  const host = config.get('objectProcessor.host')

  return {
    uploadId,
    uploadUrl,
    statusUrl: statusUrl.startsWith('http') ? statusUrl : `${host}${statusUrl}`,
    correlationId: uploadId
  }
}

export async function getUploadStatus (statusUrl) {
  logger.info({ statusUrl }, 'Checking upload status with object processor')

  const token = await getAccessToken()
  const headers = {
    'Content-Type': 'application/json'
  }

  // Only add Authorization header if token exists (Cognito enabled)
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(statusUrl, {
    method: 'GET',
    headers
  })

  if (!response.ok) {
    const errorText = await response.text()
    logger.error({ status: response.status, statusUrl, error: errorText }, 'Object processor status check failed')
    throw new Error(`Object processor status check error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  logger.info({ statusUrl }, 'Object processor status check successful')

  return data
}

export async function getMetadataBySbi (sbi) {
  logger.info({ sbi }, 'Getting metadata by SBI from object processor')

  return makeRequest(`/api/v1/metadata/sbi/${sbi}`, {
    method: 'GET'
  })
}
