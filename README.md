# ARA — Autonomous Respond Agent

NestJS + TypeScript backend for a Kenyan real-estate agency. Includes tenant-scoped RAG, agency accounts, team access, conversations and a PostgreSQL-backed inbound AI worker.

## Setup
1. Copy `.env.example` to `.env`; set OpenAI key, 32+ character ingestion key and JWT secret.
2. Start PostgreSQL: `docker compose up -d db`.
3. Apply SQL migrations in order: `001_init.sql`, `002_platform.sql`, `003_tenant_rag.sql`, `004_message_worker.sql`, `005_worker_recovery.sql`, `006_properties.sql`.
4. Run `npm ci`, `npm run build`, `npm test`, then `npm run start:dev`.

## Property management
Authenticated agency users can manage structured property records through `GET /platform/properties`, `POST /platform/properties`, `PATCH /platform/properties/:id`, and `POST /platform/properties/:id/status`. Property records are tenant-scoped and indexed into the agency's RAG knowledge base. Supported statuses: `available`, `reserved`, `let`, `sold`, `inactive`. Listing availability and pricing must be kept current by agency staff.

## Key API
- `POST /platform/register`: create agency owner; returns generated agency slug.
- `POST /platform/login`: requires `agencySlug,email,password`.
- `POST /platform/refresh` and `POST /platform/logout`.
- Authenticated `POST /knowledge`: add/update a knowledge document in the caller's agency.
- Authenticated `POST /answer`: answer using only that agency's indexed knowledge.
- Authenticated platform routes: `/platform/team`, `/platform/conversations`, `/platform/escalations`.

## Message processing
Post an inbound message to `POST /platform/conversations/:id/messages` with `{direction:"inbound",body,idempotencyKey}`. A database polling worker claims pending inbound messages using `FOR UPDATE SKIP LOCKED`, invokes tenant-scoped RAG, stores an AI reply and opens an escalation when RAG returns `needs_human`. The AI reply is queued in the database; it is not delivered externally.

## Safety and production status
All tenant knowledge writes and retrievals use the agency ID from a verified access token. Existing NULL-tenant documents are not exposed. WhatsApp inbound webhook support is available when the four WhatsApp environment variables are configured. This first adapter intentionally maps one configured WhatsApp phone number to one agency; it verifies Meta's GET challenge and POST HMAC signature, deduplicates webhook message IDs, and queues inbound text for the tenant RAG worker. Non-text media is recorded as a human-review placeholder and is not interpreted. Outbound WhatsApp delivery is not implemented yet. The worker runs inside the API process; deploy a single worker-enabled instance or add a dedicated worker lease before horizontal scaling. Apply migrations and run build, unit, integration and security tests before production. Use HTTPS, rate limiting, secrets management, backups and monitoring.
