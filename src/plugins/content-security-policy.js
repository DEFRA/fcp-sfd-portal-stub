import Blankie from 'blankie'
import { config } from '../config/config.js'

// Hash 'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw=' is to support a GOV.UK frontend script bundled within Nunjucks macros
// https://frontend.design-system.service.gov.uk/import-javascript/#if-our-inline-javascript-snippet-is-blocked-by-a-content-security-policy

const uploadMode = config.get('uploadMode')

// Configure CSP based on upload mode
const connectSrc = ['self']
const formAction = ['self']

if (uploadMode === 'direct') {
  // Direct mode: Allow fetch() and form POST to CDP Uploader domains
  connectSrc.push('https://*.cdp-int.defra.cloud')
  formAction.push('https://*.cdp-int.defra.cloud')

  // Allow additional upload domains (e.g., local development stub)
  const additionalDomains = config.get('additionalUploadDomains')
  if (additionalDomains) {
    const domains = additionalDomains.split(',').map(d => d.trim()).filter(d => d.length > 0)
    connectSrc.push(...domains)
    formAction.push(...domains)
  }
}
// In gateway-routing mode, only 'self' is needed since nginx handles routing

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
