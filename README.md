# FCP Rural Payments Portal Stub

A reference implementation demonstrating how client portals (such as the Rural Payments portal) can integrate with the **Single Front Door (SFD) Document Upload Service**.

This stub showcases the complete integration pattern including authentication, metadata submission, browser-based file uploads, and status tracking through the SFD infrastructure.

> **IMPORTANT**: This particular pattern is still a work in progress that is in the process of being verified.  Once confirmed, this warning will be removed.
>
> For latest progress contact John Watson (john.watson1@defra.gov.uk).

## Purpose

This stub portal serves as a **working example** for external teams integrating their portals with the SFD Document Upload Service. It demonstrates:

- How to authenticate with the Object Processor using AWS Cognito (via CDP API Gateway)
- How to initiate upload sessions with business metadata
- How to integrate with the CDP Uploader for secure, browser-based file uploads
- How to poll for upload status and display results to users

## Architecture Overview

The SFD Document Upload Service consists of three main components working together:

```mermaid
sequenceDiagram
    autonumber
    participant User as User Browser
    participant Portal as Portal Stub<br/>(This Service)
    participant Cognito as AWS Cognito<br/>(CDP API Gateway)
    participant Processor as Object Processor<br/>(SFD Document Upload API)
    participant Uploader as CDP Uploader
    participant S3 as AWS S3<br/>(SFD File Storage)

    Note over Portal: Mandatory metadata collected CRN, SBI, FRN,<br/>reference, document type
    
    Portal->>+Cognito: POST /oauth2/token<br/>(client_credentials)
    Cognito-->>-Portal: Access Token (JWT)
    
    Portal->>+Processor: POST /api/v1/initiate<br/>Authorization: Bearer {token}<br/>Metadata (SBI, CRN, FRN, etc.)
    Processor->>+Uploader: POST /initiate<br/>(forward request)
    Uploader-->>-Processor: { uploadId, uploadUrl, statusUrl }
    Note over Processor: Transform response:<br/>- Generate correlationId<br/>- Prefix uploadUrl with domain<br/>- Replace statusUrl with own endpoint
    Processor-->>-Portal: { correlationId, uploadId, uploadUrl, statusUrl }
    
    Note over Portal,User: Portal displays upload form<br/>with uploadUrl action
    
    User->>+Uploader: POST {uploadUrl}<br/>multipart/form-data (files)
    Uploader->>Uploader: Virus scan files
    Uploader->>S3: Upload files to S3
    Uploader-->>Processor: POST /api/v1/callback<br/>(scan results)
    Uploader-->>-User: 302 Redirect (upload accepted)
    
    Note over User,Portal: Browser redirects to processing page
    
    loop Every 3 seconds
        Portal->>+Processor: GET {statusUrl}<br/>Authorization: Bearer {token}
        Processor-->>-Portal: { status: IN_PROGRESS/SUCCESSFUL/REJECTED }
    end
    
    Note over Portal,User: Display success/error page
```

### Component Roles

**Portal Stub (this repository)**  
- Client-facing GOV.UK frontend application
- Collects business metadata (CRN, SBI, FRN, document type, reference)
- Obtains OAuth2 tokens from AWS Cognito
- Calls Object Processor APIs to initiate uploads and check status
- Posts files to CDP Uploader via the browser for file uploads

**Object Processor** ([DEFRA/fcp-sfd-object-processor](https://github.com/DEFRA/fcp-sfd-object-processor))
- **The face of the SFD Document Upload Service**
- Acts as an intermediary between clients and CDP Uploader
- Validates JWT tokens from Cognito via Microsoft Entra ID
- Provides `/api/v1/initiate` endpoint to create upload sessions
- Provides `/api/v1/status/{correlationId}` endpoint to query upload status
- Receives callbacks from CDP Uploader when files are scanned
- Persists metadata to MongoDB and publishes events to AWS SNS

**CDP Uploader** ([DEFRA/cdp-uploader](https://github.com/DEFRA/cdp-uploader))
- Handles browser-based file uploads via multipart form submissions
- Performs virus scanning using ClamAV
- Uploads clean files to AWS S3
- Sends scan results back to Object Processor via callback endpoint
- Responds to browser with 302 redirect on successful upload acceptance

## Dependencies

### Local Development (Default)

For local development, this repository includes a **Document Upload Stub** ([document-upload-stub/](document-upload-stub/)) that replaces both the Object Processor and CDP Uploader services. This stub is **used by default** when running `docker compose up`, allowing you to run the portal end-to-end without any external dependencies.

The stub provides all necessary endpoints:
- `POST /api/v1/initiate` - Initiates upload sessions
- `GET /api/v1/status/{correlationId}` - Returns upload status
- `POST /upload-and-scan/{uploadId}` - Accepts file uploads

**What the stub does:**
- Accepts all uploads and marks them as SUCCESSFUL after 2 seconds
- Uses in-memory storage (no database required)
- Runs on port 3021 (accessible at `http://localhost:3021`)
- No authentication required
- Perfect for local testing and development

**Content Security Policy Configuration:**

The portal uses Content Security Policy (CSP) to restrict which domains the browser can connect to for file uploads. For the local stub to work, you need to allow `http://localhost:3021` in the CSP configuration.

This is configured via the `ADDITIONAL_UPLOAD_DOMAINS` environment variable, which accepts a comma-separated list of domains:

```bash
# Allow browser to upload files to local stub
ADDITIONAL_UPLOAD_DOMAINS=http://localhost:3021

# Multiple domains (if needed)
ADDITIONAL_UPLOAD_DOMAINS=http://localhost:3021,http://another-domain:8080
```

This is **already configured by default** in [compose.yml](compose.yml), so the stub works out of the box when running `docker compose up`.

See [document-upload-stub/README.md](document-upload-stub/README.md) for more details.

### Using Real Services (Optional)

To connect to a **real Object Processor instance** instead of the stub, override the environment variable:

```bash
OBJECT_PROCESSOR_HOST=http://your-object-processor-host:3004
```

When using a real Object Processor:
- The Object Processor will provide upload URLs pointing to the real CDP Uploader
- You'll need AWS Cognito configured (`COGNITO_ENABLED=true`) if the Object Processor has authentication enabled
- Files will be uploaded to real S3 storage
- Virus scanning will be performed by the real CDP Uploader service

This works automatically when both services run in the same Docker network (e.g., via `docker compose` in the parent `fcp-sfd-core` repository).

**Example configuration for real services:**

```bash
# Enable Cognito authentication
COGNITO_ENABLED=true
COGNITO_DOMAIN=your-app.auth.eu-west-2.amazoncognito.com
COGNITO_CLIENT_ID=your-client-id
COGNITO_CLIENT_SECRET=your-client-secret

# Point to real Object Processor
OBJECT_PROCESSOR_HOST=https://fcp-sfd-object-processor:3004
```

## Authentication with Cognito

The portal authenticates with the Object Processor using **AWS Cognito** via the **CDP API Gateway**.

### Cognito Configuration

Required environment variables (see [.env.example](.env.example)):

```bash
# Enable/disable Cognito authentication
COGNITO_ENABLED=false              # Set to 'true' for production

# Cognito OAuth2 settings (required when COGNITO_ENABLED=true)
COGNITO_DOMAIN=your-app.auth.eu-west-2.amazoncognito.com
COGNITO_CLIENT_ID=your-client-id-here
COGNITO_CLIENT_SECRET=your-client-secret-here
```

### Disabling Cognito for Local Development

By default, Cognito is **disabled** for easier local development:

```bash
COGNITO_ENABLED=false
```

When disabled:
- No OAuth2 tokens are obtained or sent
- Object Processor must have `AUTH_ENABLED=false` to accept unauthenticated requests
- Perfect for local testing without AWS infrastructure

To enable Cognito:

1. Set `COGNITO_ENABLED=true` in `.env`
2. Configure the three `COGNITO_*` variables
3. Ensure Object Processor has `AUTH_ENABLED=true`
4. Restart the service

## Environment Variables

Copy [.env.example](.env.example) to `.env` and configure as needed:

```bash
# Copy the example file
cp .env.example .env

# Edit with your values
vi .env
```

**Example configuration** (from `.env.example`):

```bash
# Enable Cognito authentication (default: false for local dev)
COGNITO_ENABLED=true

# AWS Cognito OAuth2 settings
COGNITO_DOMAIN=your-service-c63f2.auth.eu-west-2.amazoncognito.com
COGNITO_CLIENT_ID=your-app-client-id-here
COGNITO_CLIENT_SECRET=your-app-client-secret-here

# Object Processor location (default: docker network service name)
# Override this if running Object Processor elsewhere
OBJECT_PROCESSOR_HOST=http://fcp-sfd-object-processor:3004

# Additional upload domains for CSP (for local development stub)
ADDITIONAL_UPLOAD_DOMAINS=http://localhost:3021
```

## Browser-Based Upload Nuances

The upload process uses **direct browser-to-CDP-Uploader communication** rather than proxying files through the portal backend. This is important for scalability and security.

### How It Works

1. **Portal calls Object Processor** `/api/v1/initiate` and receives upload details
2. **Portal renders a form** with `action="{uploadUrl}"` pointing directly at CDP Uploader
3. **User selects files** in their browser
4. **JavaScript intercepts the form submission** and uses `fetch()` to POST files to CDP Uploader
5. **CDP Uploader responds** with a `302 redirect` when upload is accepted
6. **JavaScript detects the redirect** (`response.type === 'opaqueredirect'`) and navigates to the processing page

### Object Processor Response

When you call `/api/v1/initiate`, the Object Processor forwards the request to CDP Uploader's `/initiate` endpoint, which returns:

```json
{
  "uploadId": "fc730e47-73c6-4219-a3c5-49b6dfce6e71",
  "uploadUrl": "/upload-and-scan/fc730e47-73c6-4219-a3c5-49b6dfce6e71",
  "statusUrl": "https://cdp-uploader.{env}.cdp-int.defra.cloud/status/fc730e47-73c6-4219-a3c5-49b6dfce6e71"
}
```

The Object Processor then **transforms** this response to provide a client-facing API:

```json
{
  "correlationId": "3f8a6c92-7b41-4e5d-9c2a-1f7b8d3e6a54",
  "uploadId": "fc730e47-73c6-4219-a3c5-49b6dfce6e71",
  "uploadUrl": "https://cdp-uploader.{env}.cdp-int.defra.cloud/upload-and-scan/fc730e47-73c6-4219-a3c5-49b6dfce6e71",
  "statusUrl": "https://fcp-sfd-object-processor.{env}.cdp-int.defra.cloud/status/3f8a6c92-7b41-4e5d-9c2a-1f7b8d3e6a54"
}
```

**Transformation Details:**
- **`correlationId`** - Newly generated by Object Processor for tracking this upload session
- **`uploadId`** - Passed through unchanged from CDP Uploader
- **`uploadUrl`** - CDP Uploader's relative path prefixed with full domain
- **`statusUrl`** - Replaced with Object Processor's endpoint using `correlationId` (instead of CDP Uploader's endpoint with `uploadId`)

**Why the transformation?**
- Portals interact only with Object Processor, never directly with CDP Uploader APIs
- Object Processor maintains its own correlation tracking separate from CDP's upload IDs
- Status checks route through Object Processor, which aggregates CDP status with its own metadata
- Provides a consistent API abstraction layer for SFD Document Upload Service

**Field Descriptions:**
- `correlationId` - Object Processor's tracking ID for this upload session
- `uploadId` - CDP Uploader's upload identifier
- `uploadUrl` - Direct URL for browser to POST files to CDP Uploader (only browser-to-CDP communication)
- `statusUrl` - URL to poll for upload status through Object Processor (uses `correlationId`)

In local development, the URLs use `localhost` domains (e.g., `http://cdp-uploader:7337/upload-and-scan/{uploadId}`).

### Why 302 Redirect Handling?

CDP Uploader returns a **relative** `302 redirect` response when it accepts an upload for processing.

This means that we cannot rely on the browser's default redirect handling, as it would attempt to follow the redirect to a path within the CDP Uploader service instead of navigating back to the client's processing page.

We must instead intercept the form submit and detect the redirect response in JavaScript to programmatically navigate to the correct next page.

See [src/client/javascript/document-upload.js](src/client/javascript/document-upload.js):

#### Progressive enhancement challenge

This approach relies on JavaScript to handle the upload and redirect flow, which means that users without JavaScript enabled will not be able to complete the upload process. However, given the technical requirements of direct browser-to-CDP communication and 302 redirect handling, this is currently the only viable solution.

It is CDP's intention to support absolute redirects in the future.

### Security Benefits

- **No file data passes through the portal server** (reduces bandwidth and attack surface)
- **Direct S3 access** from CDP Uploader (faster, more scalable)
- **Virus scanning happens before storage** (CDP Uploader scans then uploads to S3)
- **Portal only handles metadata** (lightweight API calls)

## Running Locally

### Prerequisites

- Docker and Docker Compose

### Quick Start

```bash
docker compose up
```

## User Journey

The portal implements a 6-step user journey following GOV.UK Design System patterns:

1. **Sign In** ([/document-upload/sign-in](http://localhost:3020/document-upload/sign-in))
   - User enters their 10-digit CRN (Customer Reference Number)
   - CRN stored in session cookie

2. **Enter Metadata** ([/document-upload/metadata](http://localhost:3020/document-upload/metadata))
   - **SBI** (Single Business Identifier) - 9 digits
   - **FRN** (Firm Reference Number) - 10 digits
   - **Reference** - User's own reference text
   - **Type** - Document type (e.g., CS_Agreement_Evidence)
   - **Service** - Source system (fcp-sfd-frontend or rps-portal)

3. **Upload Files** ([/document-upload/upload](http://localhost:3020/document-upload/upload))
   - Portal calls Object Processor `/api/v1/initiate` with metadata
   - Receives `correlationId`, `uploadId`, `uploadUrl`, and `statusUrl` from Object Processor
   - Browser submits files directly to CDP Uploader using `uploadUrl`
   - CDP Uploader responds with 302 redirect on acceptance

4. **Processing** ([/document-upload/processing](http://localhost:3020/document-upload/processing))
   - Auto-polls Object Processor using `statusUrl` every 3 seconds
   - Shows scanning progress (IN_PROGRESS → SUCCESSFUL/REJECTED)
   - CDP Uploader performs virus scan and uploads to S3 in background

5. **Success** ([/document-upload/success](http://localhost:3020/document-upload/success))
   - Displays confirmation with submission ID
   - Lists uploaded files and metadata

6. **Error** ([/document-upload/error](http://localhost:3020/document-upload/error))
   - Shown if files rejected (e.g., virus detected)
   - Displays rejection reason and affected files

## Testing

### Unit Tests

```bash
# Run all tests
npm run docker:test

# Run tests in watch mode (TDD)
npm run docker:test:watch

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

### Manual Testing in Browser

1. Start both Object Processor and Portal Stub (see "Running Locally" above)
2. Navigate to [http://localhost:3020/document-upload/sign-in](http://localhost:3020/document-upload/sign-in)
3. Enter CRN: `1234567890`
4. Click "Continue"
5. Fill in metadata:
   - SBI: `123456789`
   - FRN: `1234567890`
   - Reference: `Test Upload`
   - Type: Select "CS Agreement Evidence"
   - Service: Select "FCP SFD Frontend"
6. Click "Continue"
7. Select a file to upload
8. Click "Upload documents"
9. Wait for processing (auto-refreshes every 3 seconds)
10. View success or error page

## Key Files

- [src/routes/document-upload.js](src/routes/document-upload.js) - 6 route handlers for upload journey
- [src/client/javascript/document-upload.js](src/client/javascript/document-upload.js) - Browser upload with 302 redirect handling
- [src/common/helpers/cognito.js](src/common/helpers/cognito.js) - Cognito OAuth2 client with token caching
- [src/common/helpers/object-processor.js](src/common/helpers/object-processor.js) - Object Processor API client (`initiate`, `status`)
- [src/config/config.js](src/config/config.js) - Convict configuration schema
- [.env.example](.env.example) - Environment variable template

## Related Repositories

- **Object Processor**: [DEFRA/fcp-sfd-object-processor](https://github.com/DEFRA/fcp-sfd-object-processor) - SFD Document Upload API
- **CDP Uploader**: [DEFRA/cdp-uploader](https://github.com/DEFRA/cdp-uploader) - File upload and virus scanning service

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
