import { config } from '../../config/config.js'
import { createLogger } from './logging/logger.js'

const logger = createLogger()

let cachedToken = null
let tokenExpiry = null

export async function getAccessToken () {
  const cognitoEnabled = config.get('cognito.enabled')

  if (!cognitoEnabled) {
    logger.debug('Cognito authentication disabled, returning null token')
    return null
  }

  // Return cached token if still valid (with 5 minute buffer)
  const bufferMs = 5 * 60 * 1000
  if (cachedToken && tokenExpiry && Date.now() < (tokenExpiry - bufferMs)) {
    logger.debug('Using cached Cognito access token')
    return cachedToken
  }

  const domain = config.get('cognito.domain')
  const clientId = config.get('cognito.clientId')
  const clientSecret = config.get('cognito.clientSecret')

  if (!domain) {
    throw new Error('COGNITO_DOMAIN is required when COGNITO_ENABLED=true')
  }
  if (!clientId) {
    throw new Error('COGNITO_CLIENT_ID is required when COGNITO_ENABLED=true')
  }
  if (!clientSecret) {
    throw new Error('COGNITO_CLIENT_SECRET is required when COGNITO_ENABLED=true')
  }

  const tokenUrl = `https://${domain}/oauth2/token`
  const requestBody = 'grant_type=client_credentials'

  logger.info({ tokenUrl, clientId }, 'Requesting Cognito access token')

  try {
    // Encode credentials for Basic Auth
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`
      },
      body: requestBody
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error({
        status: response.status,
        error: errorText,
        tokenUrl
      }, 'Failed to get Cognito token')
      throw new Error(`Cognito authentication failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()

    // Cache the token in memory
    cachedToken = data.access_token
    tokenExpiry = Date.now() + (data.expires_in * 1000)

    logger.info({ expiresIn: data.expires_in }, 'Successfully obtained Cognito access token')

    return cachedToken
  } catch (error) {
    logger.error({ error, tokenUrl }, 'Error getting Cognito access token')
    throw error
  }
}

export function clearCachedToken () {
  cachedToken = null
  tokenExpiry = null
  logger.debug('Cleared cached OAuth2 token')
}
