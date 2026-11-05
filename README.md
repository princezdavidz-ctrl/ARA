# ARA — Autonomous Respond Agent

NestJS + TypeScript backend for a Kenyan real-estate agency. Includes tenant-scoped RAG, agency accounts, team access, conversations and a PostgreSQL-backed inbound AI worker.

## Setup
1. Copy .env.example to .env; set OpenAI key, 32+ character ingestion key and JWT secret.
2. Start PostgreSQL with docker compose up -d db.
3. Apply SQL migrations 001_init.sql through 010_social_channels.sql in order.
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

## Email channel
ARA supports email conversations using Resend for outbound delivery and a signed inbound relay endpoint. Configure EMAIL_AGENCY_ID, EMAIL_RESEND_API_KEY, EMAIL_FROM_ADDRESS and EMAIL_WEBHOOK_SECRET together; leave all four blank to keep email disabled. The sender address must be verified with Resend.

Inbound email relays POST JSON to /webhooks/email with headers X-ARA-Email-Timestamp (Unix seconds) and X-ARA-Email-Signature (sha256=HMAC-SHA256(secret, timestamp + "." + raw request body)). Timestamps must be within five minutes. The JSON contract is { "from": { "email": "customer@example.com", "name": "Customer" }, "subject": "Property enquiry", "text": "Message body", "messageId": "unique-provider-message-id" }. The relay must verify the upstream provider's webhook and then sign the normalized body using this ARA signature. Inbound IDs are deduplicated and tenant-scoped. ARA generates a grounded response using the same RAG worker and sends it as an email reply; human replies can be queued through the existing conversation message API, optionally with a subject.

Email retries use the same maximum-five-attempt exponential backoff and provider idempotency key. ARA marks an email sent only after Resend accepts it and returns an ID; this is not proof of inbox delivery. Provider-specific inbound relay setup and delivery/read receipts are separate integration work.

## Instagram Direct Messages
Instagram inbound messages are accepted at /webhooks/instagram after Meta's hub.challenge verification and X-Hub-Signature-256 validation. Configure INSTAGRAM_AGENCY_ID, INSTAGRAM_ACCOUNT_ID, INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_APP_SECRET and INSTAGRAM_VERIFY_TOKEN together. The linked Instagram professional account and Meta app must have the required messaging permissions and production review. A customer must initiate the conversation; the standard messaging window applies. Replies are sent through Instagram's Messaging API and retried up to five times. Attachments are recorded and escalated for human review.

## TikTok Business Messaging
TikTok inbound messages are accepted at /webhooks/tiktok and normalized from DIRECT_MESSAGE webhook content. Configure TIKTOK_AGENCY_ID, TIKTOK_BUSINESS_ID (the authorized account open_id), TIKTOK_ACCESS_TOKEN and TIKTOK_WEBHOOK_SECRET together. The TikTok developer app must be approved for Business Messaging and the business account must authorize it. The endpoint expects X-ARA-TikTok-Timestamp (Unix seconds) and X-ARA-TikTok-Signature (sha256=HMAC-SHA256(secret, timestamp + "." + raw request body)); a provider relay should validate TikTok's native webhook and sign the normalized payload for ARA. The normalized payload contains event_type=DIRECT_MESSAGE and content with conversation_id, message_id, from_user.open_id, message_type and text.body. Replies use TikTok's official Business Messaging send endpoint and conversation_id. TikTok messaging windows and quota rules apply; users must initiate contact. Access tokens are short-lived and must be refreshed by the operator; automated OAuth token refresh is not yet implemented.
