# Copilot Instructions for FCP SFD Portal Stub

## Project Overview

This is a **reference implementation** demonstrating how client portals integrate with the **SFD Document Upload Service**. It's a stub/example, not a production portal. The codebase showcases:

- OAuth2 authentication with AWS Cognito (via CDP API Gateway)
- Initiating upload sessions with business metadata via Object Processor API
- Browser-based file uploads directly to CDP Uploader (files bypass portal backend)
- Polling for upload status through Object Processor

**Critical Architecture**: Files flow User Browser → CDP Uploader → S3, **not** through this portal's backend. The portal only handles metadata and orchestration.

## Tech Stack Conventions

- **ESM modules only** - all `import`/`export`, no CommonJS (`require`/`module.exports`)
- **Hapi.js 21** - server framework with plugin architecture
- **Nunjucks** - templating engine with GOV.UK Frontend components
- **Webpack** - bundles client-side JS/SCSS from `src/client/`
- **Vitest** - testing framework with `vi` mocking utilities
- **Neostandard** - ESLint config (ECMAScript 2025)
- **Convict** - schema-based configuration management
- **Pino** - structured logging in ECS format (production) or pretty format (dev)

## Code Patterns

### Route Definitions

Routes export objects with `method`, `path`, and `handler` properties:

```javascript
export const metadataGet = {
  method: 'GET',
  path: '/document-upload/metadata',
  handler: (request, h) => {
    // Route logic
  }
}
```

All routes are auto-registered via [src/plugins/router.js](../src/plugins/router.js) which finds route files in `src/routes/`.

### Session State

Use `request.yar` (Hapi Yar plugin) for session management:

```javascript
request.yar.set('metadata', metadata)
const crn = request.yar.get('crn')
```

Session cookies configured in [src/plugins/session.js](../src/plugins/session.js).

### Configuration

Use [src/config/config.js](../src/config/config.js) convict schema. Access via:

```javascript
import { config } from './config/config.js'
const host = config.get('objectProcessor.host')
```

Override with environment variables (see `../.env.example`).

### Logging

Import `createLogger()` from [src/common/helpers/logging/logger.js](../src/common/helpers/logging/logger.js):

```javascript
const logger = createLogger()
logger.info({ submissionId }, 'Initiating upload')
logger.error({ error, statusUrl }, 'Status check failed')
```

Use structured logging with context objects.

### Object Processor Integration

Two main API calls in [src/common/helpers/object-processor.js](../src/common/helpers/object-processor.js):

1. **`initiateUpload(metadata)`** - POST `/api/v1/initiate` with business metadata, returns `{correlationId, uploadId, uploadUrl, statusUrl}`
2. **`getUploadStatus(statusUrl)`** - GET status URL to poll upload progress

Both automatically include OAuth2 Bearer token when Cognito enabled (`COGNITO_ENABLED=true`).

### Browser Upload Pattern

**Critical**: Client-side JavaScript in [src/client/javascript/document-upload.js](../src/client/javascript/document-upload.js) intercepts form submission and POSTs files directly to CDP Uploader:

```javascript
const response = await fetch(uploadUrl, {
  method: 'POST',
  body: formData,
  redirect: 'manual'
})

// CDP Uploader responds with 302 redirect on acceptance
if (response.type === 'opaqueredirect' || response.status === 302) {
  window.location.href = '/document-upload/processing'
}
```

This redirect handling is **project-specific** - CDP Uploader returns 302 when upload accepted for scanning.

## Document Upload Stub (Local Development)

The `document-upload-stub/` directory contains a **local development stub** that replaces both Object Processor and CDP Uploader. This stub is **used by default** in `docker compose up`, eliminating external dependencies for local development.

### Stub Architecture

- **Hapi.js server** on port 3021 (`http://localhost:3021`)
- **In-memory storage** for upload sessions (no database)
- **CORS enabled** to accept browser requests from portal (port 3020)
- **No authentication** required (suitable for local dev only)

### Stub Endpoints

1. **POST `/api/v1/initiate`** - Creates upload session, returns `{correlationId, uploadId, uploadUrl, statusUrl}`
2. **GET `/api/v1/status/{correlationId}`** - Returns upload status (simulates IN_PROGRESS → SUCCESSFUL after 2s)
3. **POST `/upload-and-scan/{uploadId}`** - Accepts file uploads, returns 302 redirect

### Key Files in Stub

- `document-upload-stub/src/server.js` - Hapi server setup with CORS
- `document-upload-stub/src/routes/object-processor.js` - Object Processor API stubs
- `document-upload-stub/src/routes/uploader.js` - CDP Uploader stub
- `document-upload-stub/src/config/config.js` - Simple convict config (port, uploaderHost)

### How Sessions Work

Sessions stored in `Map()` keyed by `correlationId`. The uploader route uses `getSessionByUploadId()` helper to find sessions and `updateSessionStatus()` to mark them SUCCESSFUL after timeout.

### CSP Configuration

Portal's CSP ([src/plugins/content-security-policy.js](../src/plugins/content-security-policy.js)) allows additional upload domains via the `ADDITIONAL_UPLOAD_DOMAINS` environment variable (comma-separated). In local development, this is set to `http://localhost:3021` in [compose.yml](../compose.yml) to permit browser fetch() calls to the stub.

## Development Workflow

### Local Development

```bash
# Start with Docker (includes document-upload-stub by default)
docker compose up

# Or run directly (requires Node 24.12.0+)
npm install
npm run dev  # Starts webpack watch + nodemon
```

Portal runs on `http://localhost:3020`, stub runs on `http://localhost:3021`. 

**Default behavior**: `OBJECT_PROCESSOR_HOST` defaults to `http://document-upload-stub:3021` in `compose.yml`, so the portal uses the local stub automatically.

**To use real Object Processor**: Override with `OBJECT_PROCESSOR_HOST=http://fcp-sfd-object-processor:3004` in `.env`.

### Testing

```bash
# Run unit tests with coverage (in Docker)
npm run docker:test

# Watch mode for TDD
npm run docker:test:watch

# Lint
npm run lint
npm run lint:fix
```

Tests use Vitest with `vi.mock()` for dependency injection. See [test/unit/routes/document-upload.test.js](../test/unit/routes/document-upload.test.js) for patterns.

### Cognito Authentication

Toggle with `COGNITO_ENABLED=false` (default for local dev). When disabled, no tokens sent and Object Processor must have `AUTH_ENABLED=false`.

For production: set `COGNITO_ENABLED=true` and configure `COGNITO_DOMAIN`, `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`.

## Key Directories

- **`src/routes/`** - Route handlers (auto-registered by router plugin)
- **`src/plugins/`** - Hapi plugins (CSP, headers, router, session)
- **`src/common/helpers/`** - Shared utilities (Cognito, Object Processor client, logging)
- **`src/config/`** - Convict config schema and Nunjucks setup
- **`src/client/`** - Frontend JavaScript/SCSS (bundled by Webpack)
- **`src/views/`** - Nunjucks templates
- **`test/unit/`** - Vitest unit tests mirroring `src/` structure
- **`document-upload-stub/`** - Local development stub (replaces Object Processor + CDP Uploader)

## Integration Points

**Default (Local Development)**:
1. **Document Upload Stub** - Included in this repo at `document-upload-stub/`, used by default in `docker compose up`
   - Combines Object Processor and CDP Uploader functionality
   - Runs on `http://localhost:3021`
   - No authentication required
   - In-memory session storage

**Optional (Production/Testing)**:
1. **Object Processor** - Backend API for SFD Document Upload Service at `OBJECT_PROCESSOR_HOST`
2. **CDP Uploader** - File upload service (URL provided by Object Processor, browser connects directly)
3. **AWS Cognito** - OAuth2 token provider via CDP API Gateway (required when using real Object Processor)

## Common Tasks

**Add a new route**: Create handler in `src/routes/`, export objects with `{method, path, handler}`. Router plugin auto-registers.

**Add config value**: Update `src/config/config.js` convict schema, add to `../.env.example`.

**Mock external APIs in tests**: Use `vi.mock()` at top of test file (see existing tests for patterns).

**Update GOV.UK styles**: Modify SCSS in `src/client/stylesheets/`, Webpack rebuilds on save in dev mode.

**Add Hapi plugin**: Register in `src/server.js` `server.register([...])` array.
