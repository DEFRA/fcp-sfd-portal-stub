import Blankie from 'blankie'
import { config } from '../config/config.js'

// Hash 'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw=' is to support a GOV.UK frontend script bundled within Nunjucks macros
// https://frontend.design-system.service.gov.uk/import-javascript/#if-our-inline-javascript-snippet-is-blocked-by-a-content-security-policy

const uploadMode = config.get('uploadMode')

const connectSrc = ['self']
const formAction = ['self']

// Gateway-routing mode uses only 'self' - NGINX handles all routing
if (uploadMode !== 'gateway-routing') {
  const cdpDomains = ['https://*.cdp-int.defra.cloud', 'https://*.cdp.defra.gov.uk']
  const additionalDomains = config.get('additionalUploadDomains')
  const parsedAdditionalDomains = additionalDomains
    ? additionalDomains.split(',').map(d => d.trim()).filter(d => d.length > 0)
    : []

  // Both direct and frontend-redirect modes allow form POST to uploader
  formAction.push(...cdpDomains, ...parsedAdditionalDomains)

  // Only direct mode needs connectSrc (for JavaScript fetch())
  if (uploadMode === 'direct') {
    connectSrc.push(...cdpDomains, ...parsedAdditionalDomains)
  }
}

export const contentSecurityPolicy = {
  plugin: Blankie,
  options: {
    fontSrc: ['self'],
    imgSrc: ['self'],
    scriptSrc: ['self', "'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw='"],
    styleSrc: ['self'],
    frameAncestors: ['self'],
    formAction,
    manifestSrc: ['self'],
    connectSrc,
    generateNonces: true
  }
}
