// Client identifier to absolute domain mapping
const CLIENT_MAPPINGS = {
  'portal-stub': 'http://localhost:3020'
}

export const redirectGet = {
  method: 'GET',
  path: '/fcp-sfd-doc-upload/{clientIdentifier}/{relativePath*}',
  handler: (request, h) => {
    const { clientIdentifier, relativePath } = request.params
    const queryString = new URLSearchParams(request.query).toString()

    request.logger.info({ clientIdentifier, relativePath, query: request.query }, 'Redirect request received')

    const baseDomain = CLIENT_MAPPINGS[clientIdentifier]

    if (!baseDomain) {
      request.logger.error({ clientIdentifier }, 'Client identifier not found in mappings')
      return h.response({
        statusCode: 404,
        error: 'Not Found',
        message: `Client '${clientIdentifier}' not found in redirect mappings`
      }).code(404)
    }

    // Construct the full redirect URL
    const path = relativePath || ''
    let redirectUrl = `${baseDomain}/${path}`

    // Append query parameters if present
    if (queryString) {
      redirectUrl += `?${queryString}`
    }

    request.logger.info({ clientIdentifier, redirectUrl }, 'Redirecting to client URL')

    return h.redirect(redirectUrl).code(302)
  }
}
