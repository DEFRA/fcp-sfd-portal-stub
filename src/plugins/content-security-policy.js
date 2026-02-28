import Blankie from 'blankie'
import { config } from '../config/config.js'

// Hash 'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw=' is to support a GOV.UK frontend script bundled within Nunjucks macros
// https://frontend.design-system.service.gov.uk/import-javascript/#if-our-inline-javascript-snippet-is-blocked-by-a-content-security-policy

// Allow fetch() requests to CDP Uploader across environments
const connectSrc = ['self', 'https://*.cdp-int.defra.cloud']

// Allow additional upload domains (e.g., local development stub)
const additionalDomains = config.get('additionalUploadDomains')
if (additionalDomains) {
  const domains = additionalDomains.split(',').map(d => d.trim()).filter(d => d.length > 0)
  connectSrc.push(...domains)
}

export const contentSecurityPolicy = {
  plugin: Blankie,
  options: {
    fontSrc: ['self'],
    imgSrc: ['self'],
    scriptSrc: ['self', "'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw='"],
    styleSrc: ['self'],
    frameAncestors: ['self'],
    formAction: ['self', 'https://*.cdp-int.defra.cloud'],
    manifestSrc: ['self'],
    connectSrc,
    generateNonces: true
  }
}
