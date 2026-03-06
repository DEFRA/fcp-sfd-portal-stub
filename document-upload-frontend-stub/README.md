# Document Upload Frontend Stub

A redirect mapping service that transforms relative redirects from CDP Uploader into absolute URLs for clients on different domains.

## Purpose

This service addresses the pattern where:
1. CDP Uploader returns relative redirects after file uploads
2. Multiple clients on different domains need to be redirected to their respective absolute URLs
3. A central mapping service owned by the document upload team handles the transformation

## How It Works

When CDP Uploader redirects to `/fcp-sfd-doc-upload/{clientIdentifier}/{relativePath}`, this service:
1. Extracts the client identifier and relative path
2. Looks up the absolute domain for that client
3. Constructs the full URL: `{domain}/{relativePath}`
4. Returns a 302 redirect to the client

## Port

Runs on port **3022** by default.

## Endpoints

### `GET /fcp-sfd-doc-upload/{clientIdentifier}/{relativePath*}`

Accepts relative redirects and maps to client-specific absolute URLs.

**Path Parameters:**
- `clientIdentifier` - Client identifier (e.g., "portal-stub")
- `relativePath` - Catch-all for the rest of the path (optional, can be multi-segment)

**Query Parameters:**
- Preserved and appended to the redirect URL

**Response:**
```http
HTTP/1.1 302 Found
Location: http://localhost:3020/document-upload/processing
```

**Error Response (404):**
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Client 'unknown-identifier' not found in redirect mappings"
}
```

### `GET /health`

Health check endpoint for Docker.

**Response:**
```json
{
  "message": "success"
}
```

## Client Mappings

Currently supports a single client for local development:

```javascript
{
  'portal-stub': 'http://localhost:3020'
}
```

To add more clients, update the `CLIENT_MAPPINGS` object in [src/routes/redirect.js](src/routes/redirect.js).

## Usage

This service is automatically started when you run `docker compose up` from the root directory.

It only processes requests when the portal is running in `UPLOAD_MODE=frontend-redirect` mode.

## Implementation Details

- Built with Hapi.js to match the project's tech stack
- Uses in-memory mappings for simplicity (no database)
- CORS enabled to accept requests from any origin
- No authentication required (suitable for local development only)
