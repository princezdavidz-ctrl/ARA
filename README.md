# ARA — Autonomous Respond Agent

NestJS + TypeScript backend for a Kenyan real-estate agency. Includes tenant-scoped RAG, agency accounts, team access, conversations and a PostgreSQL-backed inbound AI worker.

## Setup
1. Copy .env.example to .env; set OpenAI key, 32+ character ingestion key and JWT secret.
2. Start PostgreSQL with docker compose up -d db.
3. Apply SQL migrations 001_init.sql through 008_whatsapp_outbound_delivery.sql in order.
4. Run npm ci, npm run build, npm test, then npm run start:dev.

## Property and lead management
Authenticated agency users can manage tenant-scoped property inventory and lead pipelines through the /platform/properties and /platform/leads endpoints. Property records are indexed into the agency RAG knowledge base. Listing availability and pricing must be kept current by agency staff.

## Agency dashboard
Open /dashboard after starting the API. The browser workspace supports agency login, overview metrics, leads, property inventory, conversations and team directory. It uses authenticated platform APIs. Conversation messages show their current delivery status; queued is not proof of delivery.

## Message processing and WhatsApp
Inbound text messages are processed by the tenant-scoped RAG worker. AI replies and human outbound messages for WhatsApp conversations are sent through Meta's WhatsApp Cloud API when WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are configured. Without these values, messages remain queued for handling in the dashboard; WhatsApp is optional.

The worker marks a message sent only after Meta accepts it and returns a message ID. This is API acceptance, not confirmed recipient delivery; webhook delivery receipts are not yet reconciled. Transient failures retry with exponential backoff for up to five attempts; permanent 4xx errors other than 429 are marked failed. Meta's customer-service window and template-message rules apply, so Meta can reject free-form messages outside the permitted window. A worker crash after Meta accepts a message but before ARA saves the response can cause a duplicate on retry (at-least-once delivery).

Inbound webhook setup remains separate and requires WHATSAPP_AGENCY_ID, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN and WHATSAPP_APP_SECRET. It maps one configured WhatsApp phone number to one agency, verifies Meta's challenge and HMAC signature, deduplicates webhook message IDs, and queues inbound text. Non-text media is escalated for human review and is not interpreted.

## Production status
The worker runs inside the API process; use one worker-enabled instance or add a dedicated worker lease before horizontal scaling. Apply migrations and run build, unit, integration and security tests before production. Use HTTPS, rate limiting, secrets management, backups and monitoring.
