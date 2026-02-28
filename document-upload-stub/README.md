# Document Upload Stub

A simple stub service for local development that replaces the need for external dependencies on:
- **Object Processor** (FCP SFD Object Processor API)
- **CDP Uploader** (CDP file upload service)

## Purpose

This stub allows developers to run the portal end-to-end locally without needing:
- Real AWS infrastructure (Cognito, S3)
- CDP Uploader service running
- Object Processor service running

## How It Works

The stub implements all the necessary endpoints that the portal needs:

### Object Processor API Endpoints
- `POST /api/v1/initiate` - Initiates upload session, returns upload URL and status URL
- `GET /api/v1/status/{correlationId}` - Returns upload status (IN_PROGRESS → SUCCESSFUL)

### CDP Uploader Endpoints
- `POST /upload-and-scan/{uploadId}` - Accepts file uploads, returns 302 redirect

## Usage

The stub is automatically started when you run `docker compose up` from the root directory.

The portal is configured to use the stub by default via the `OBJECT_PROCESSOR_HOST` environment variable in [compose.yml](../compose.yml).

## Implementation Details

- Built with Hapi.js to match the project's tech stack
- Uses in-memory storage for upload sessions
- Simulates a 2-second delay for file scanning
- Always marks uploads as SUCCESSFUL after the delay
- No authentication required (suitable for local development only)

## Port

The stub runs on port **3021** by default.
