# Copilot Instructions for fcp-sfd-portal-stub

## Project Overview
This is a **Hapi.js-based GOV.UK frontend service** for Defra's Core Delivery Platform (CDP). It follows UK government digital service patterns and Defra-specific conventions.

## Architecture & Core Patterns

### ES Modules Only
- All files use ES modules (`import`/`export`), never CommonJS
- Entry point: [../src/index.js](../src/index.js) → [../src/server.js](../src/server.js) → plugin registration
- Uses `import.meta.url` and `fileURLToPath()` for path resolution, never `__dirname`

### Hapi Plugin Architecture
Server composition happens via plugin registration in [../src/server.js](../src/server.js):
```javascript
await server.register([
  Scooter, requestLogger, requestTracing, secureContext,
  pulse, nunjucksConfig, contentSecurityPolicy, headers,
  router, session
])
```

**Plugin Pattern** (see [../src/plugins/](../src/plugins/)):
- Export object with `{ plugin: { name: string, register: function } }`
- Router delegates to route modules (not inline in plugin)
- Session/CSP/Headers configure via options objects

### Configuration Management
[../src/config/config.js](../src/config/config.js) uses **Convict** for schema-based config:
- Access via `config.get('key')` or `config.get('nested.key')`
- Environment-specific defaults: `isProduction`, `isDevelopment`, `isTest`
- Never use `process.env` directly outside config.js

### Routing Conventions
Routes live in [../src/routes/](../src/routes/) and export objects:
```javascript
export const routeName = {
  method: 'GET',
  path: '/path',
  handler: (request, h) => h.view('template')
}
```
- Register routes via [../src/plugins/router.js](../src/plugins/router.js)
- Static files served via [../src/common/helpers/serve-static-files.js](../src/common/helpers/serve-static-files.js)
- Health check at `/healthy` and `/healthz` ([../src/routes/health.js](../src/routes/health.js))

### Error Handling
[../src/common/helpers/errors.js](../src/common/helpers/errors.js) - `catchAll` onPreResponse extension:
- Boom errors → view templates (404 → [errors/404.njk](../src/views/errors/404.njk), 500 → [errors/500.njk](../src/views/errors/500.njk))
- API routes (tagged with `tags: ['api']`) return JSON, not views
- 5xx errors logged automatically

### View Layer (Nunjucks)
[../src/config/nunjucks/nunjucks.js](../src/config/nunjucks/nunjucks.js):
- GOV.UK Frontend templates loaded from `node_modules/govuk-frontend/dist/`
- Custom views in [../src/views/](../src/views/), partials in [../src/views/partials/](../src/views/partials/)
- Context/globals injected via [context.js](../src/config/nunjucks/context.js) and [globals.js](../src/config/nunjucks/globals.js)
- Templates use `.njk` extension
- Handler pattern: `h.view('template-name', context)`

**GOV.UK Design System**: 
- **Always use Design System components** from https://design-system.service.gov.uk/
- **Favor Nunjucks macros over HTML** - import and use GOV.UK component macros (buttons, inputs, etc.)
- Pattern: `{% from "govuk/components/button/macro.njk" import govukButton %}`
- See [../src/views/macros/heading/](../src/views/macros/heading/) for custom macro examples

## Development Workflow

### Docker-First Development
```bash
docker compose up          # Start dev server with hot reload
npm run docker:test        # Run tests in container
npm run docker:test:watch  # TDD mode with auto-rerun
```
Volume mounts: `src/` and `package.json` for live reload


### Frontend Build (Webpack)
[../webpack.config.js](../webpack.config.js):
- Entry: [../src/client/javascript/application.js](../src/client/javascript/application.js) + [../src/client/stylesheets/application.scss](../src/client/stylesheets/application.scss)
- Output: `.public/` directory (gitignored)
- Production: hashed filenames (`[contenthash:7]`), minified
- Development: inline source maps, faster builds
- **Run `npm run build:frontend`** before starting server if `.public/` is missing

### Testing with Vitest
[../vitest.config.js](../vitest.config.js), tests in [../test/unit/](../test/unit/):
- Pattern: `test/**/*.test.js`
- Coverage: `src/**` (excludes `.public`, `test/`, `coverage/`)
- Run with `TZ=UTC` for consistency
- Mock patterns: See [../test/unit/common/helpers/](../test/unit/common/helpers/) for examples
- **Minimal structure tests** acceptable (plugin name, register function exist)

## Security & Infrastructure

### Secure Context (TLS Certificates)
[../src/common/helpers/secure-context/secure-context.js](../src/common/helpers/secure-context/secure-context.js):
- Injects TRUSTSTORE_* env vars into TLS context
- Only enabled when `isSecureContextEnabled` config is true
- Required for CDP environments with custom CA certificates

### Proxy Configuration
[../src/common/helpers/proxy/setup-proxy.js](../src/common/helpers/proxy/setup-proxy.js):
- Configures global proxy for Undici and axios/request
- Auto-enabled if `HTTP_PROXY` env var set
- Called once in [../src/server.js](../src/server.js) before server creation

### Content Security Policy
[../src/plugins/content-security-policy.js](../src/plugins/content-security-policy.js):
- Uses Blankie plugin
- Includes GOV.UK Frontend script hash: `sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw=`
- `formAction` allows external forms (`'self', '*'`)

### Session Management
[../src/plugins/session.js](../src/plugins/session.js) via @hapi/yar:
- Cookie name/password from config
- `isSecure` from config (false in dev, true in prod)
- `isSameSite: 'Lax'` always

## Logging

[../src/common/helpers/logging/logger.js](../src/common/helpers/logging/logger.js):
- Uses Pino with ECS format (@elastic/ecs-pino-format)
- Get logger: `createLogger()`
- Request logging: `hapi-pino` configured in [request-logger.js](../src/common/helpers/logging/request-logger.js)
- Server instance has `server.logger` available

## Common Gotchas

1. **Node.js version**: Requires >= 24.12.0 (see [../package.json](../package.json) engines)
2. **ESLint**: Uses Neostandard with ECMAScript 2025, ignores `.public/`
3. **Static files**: Must be in `.public/` after webpack build, served at `/public/*`
4. **Joi validation**: Server uses Joi validator, configured with `abortEarly: false` for all errors
5. **Request tracing**: `@defra/hapi-tracing` plugin auto-generates correlation IDs
6. **Pulse monitoring**: [../src/common/helpers/pulse.js](../src/common/helpers/pulse.js) via hapi-pulse for metrics

## When Adding Features

**New Route**: 
1. Create in `src/routes/`, export route object
2. Register in [../src/plugins/router.js](../src/plugins/router.js) via `server.route()`
3. Create view in `src/views/` if needed
4. Add test in `test/unit/routes/`

**New Plugin**:
1. Create in `src/plugins/`, export with `{ plugin: { name, register } }` structure
2. Register in [../src/server.js](../src/server.js) array
3. Test plugin structure (name, register function)

**New Config**:
1. Add to [../src/config/config.js](../src/config/config.js) convict schema with doc, format, default, env
2. Access via `config.get('key')`

**Frontend Assets**:
1. JS in [../src/client/javascript/](../src/client/javascript/), SCSS in [../src/client/stylesheets/](../src/client/stylesheets/)
2. Import in [application.js](../src/client/javascript/application.js) or [application.scss](../src/client/stylesheets/application.scss)
3. Run `npm run build:frontend` or webpack watch
