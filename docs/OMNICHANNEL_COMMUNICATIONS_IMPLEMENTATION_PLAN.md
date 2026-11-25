# ARA Omnichannel Communications Implementation Plan

**Decision:** Approved — SMS inbound + outbound; voice inbound + outbound; full platform expansion; phased delivery.
**Compatibility rule:** Add capabilities without removing or weakening existing ARA features.

## Product scope

ARA will provide one tenant-isolated platform for SMS, voice calls, WhatsApp, Instagram, TikTok Business Messaging, email and website chat, with Facebook Messenger planned as an additional adapter. Every channel shares customer identity, conversation history, AI policy, human handoff, staff operations, analytics and billing.

### SMS
- Inbound/outbound one-to-one messages and two-way inbox.
- Delivery receipts, provider message IDs, retry/backoff and failed-message handling.
- STOP/START/HELP processing, consent records, suppression lists and campaign opt-out.
- Templates, scheduled reminders, approved bulk campaigns, segmentation and rate limits.
- Per-tenant sender identity, number/short-code configuration and spend limits.

### Voice
- Inbound/outbound calls with provider-neutral call lifecycle.
- AI voice receptionist with language-aware speech recognition and speech synthesis.
- IVR, business hours, queues, ring groups, voicemail and missed-call handling.
- Live transfer to available staff with conversation context and call summary.
- Outbound service/marketing calls with authorization, calling-hour and suppression controls.
- Recording/transcription only with configured legal basis, announcement/consent, access controls and retention policy.

### Shared platform
- Unified inbox and Customer 360 timeline.
- Staff presence, assignments, human takeover, internal notes and supervisor tools.
- Campaign management and no-code automation builder.
- Analytics for delivery, call outcomes, response time, conversions, provider/AI cost and subscriptions.
- Versioned developer API, signed webhooks, integration sandbox and mobile staff experience.
- Preserve all existing AI, RAG/knowledge, approvals, CRM, admin, billing, subscription, channel connection and staff-console functionality.

## Architecture

`Provider adapters -> secure webhook/API gateway -> signature/replay validation -> tenant connection resolver -> normalized event bus -> communication orchestration -> customer/conversation services -> AI orchestrator or human queue -> provider adapter`

Core boundaries:
1. **Provider adapters:** SMS and voice vendors implement stable internal interfaces. Provider-specific payloads never leak into CRM domain logic.
2. **Communication orchestration:** idempotency, queueing, retry, delivery/call state machines, quiet hours, templates and channel policy.
3. **Customer identity:** tenant-scoped profiles and verified channel addresses; link records only with deterministic evidence or user confirmation.
4. **Consent service:** purpose/channel-specific consent, provenance, timestamp, suppression and opt-out enforcement.
5. **AI voice runtime:** reuses central AI policy, company knowledge, language settings and escalation; speech recognition/synthesis are replaceable adapters.
6. **Human operations:** one staff presence and assignment model for text and calls.
7. **Campaign/workflow service:** schedules, segments, approvals, rate limits, execution ledger and idempotent actions.
8. **Metering/analytics:** provider-accepted/delivered/failed messages and call duration/outcomes, reconciled with provider statements where available.

## Provider strategy

Build the abstraction first. Evaluate Africa's Talking, Twilio and relevant country-specific vendors for Kenya and target markets. Compare two-way SMS, sender ID/short-code registration, voice number availability, outbound caller ID, webhooks, delivery receipts, call transfer, recording controls, pricing, compliance, support and geographic coverage. Do not hard-code a vendor or claim an integration is live until the account, credentials, number and callbacks are configured and verified.

## Delivery phases and acceptance criteria

### Phase 0 — Repository and staging readiness
- Inventory existing channel services, migrations, queues, message statuses and billing meters.
- Reconcile staging database migration history with repository migrations; resolve missing-table drift safely.
- Record current API contracts and regression baseline.
- No feature rollout until staging migration state is healthy.

### Phase 1 — Shared communication foundation
- Add provider-neutral channel capability and message/call event contracts.
- Define tenant-scoped customer/contact identifiers and conversation timeline extension.
- Add consent, consent provenance, suppression and opt-out domain model.
- Add normalized delivery/call states, provider references, idempotency keys and audit events.
- Add feature flags and per-tenant channel settings.
- Acceptance: tenant-isolation, duplicate-event, invalid-signature, opt-out, migration and compatibility tests.

### Phase 2 — SMS both directions
- Implement SMS provider interface and one provider adapter after provider selection.
- Secure inbound webhook validation, tenant resolution and deduplication.
- Outbound send queue, throttling, retry policy and provider error normalization.
- Delivery receipts and reconciliation; clear distinction between queued, accepted, delivered and failed.
- Two-way inbox integration with AI/human routing and staff console.
- STOP/START/HELP, consent enforcement and suppression checks before every send.
- Meter usage with idempotency and tenant billing integration.
- Acceptance: inbound/outbound lifecycle, opt-out, delivery receipt, outage, duplicate, tenant boundary and cost-metering tests.

### Phase 3 — Voice both directions
- Voice provider interface, number/tenant routing and signed call webhooks.
- Inbound AI receptionist and outbound authorized call initiation.
- Speech-to-text/text-to-speech adapters with interruption, timeout and fallback handling.
- IVR, business hours, queues, ring groups and live-agent transfer.
- Call status, duration, outcome, voicemail and missed-call callback workflows.
- Recording/transcription controls, consent announcements, encryption and retention.
- Acceptance: call lifecycle, human transfer, no-agent fallback, opt-out, recording policy, tenant boundary and provider outage tests.

### Phase 4 — Customer 360 and unified inbox
- Shared customer profile and channel-address verification.
- Timeline for messages, calls, notes, tickets, handoffs and purchases/events where integrated.
- Safe duplicate detection and merge audit.
- Staff filters, search, assignments and channel-aware customer preferences.
- Acceptance: cross-channel identity safety and tenant isolation.

### Phase 5 — Campaigns and automation
- SMS campaigns first; voice campaigns only after consent and calling-policy gates.
- Segments, templates, scheduling, time windows, throttling, approvals and suppression.
- Workflow triggers, conditions, actions, retries, pause/resume and execution history.
- Acceptance: opt-out race-condition, duplicate trigger, campaign approval and spend-cap tests.

### Phase 6 — Contact-center operations
- Staff availability, queue assignment, ring groups, supervisor dashboard and internal collaboration.
- Call wrap-up, disposition codes, callbacks, SLA and quality review.
- Acceptance: concurrency, assignment fairness, audit and shift-boundary tests.

### Phase 7 — Analytics, billing and mobile staff app
- Per-channel usage, provider costs, delivery/call outcomes, AI usage and conversions.
- Tenant-level spend limits, quota enforcement and invoice reconciliation.
- Mobile staff app workflows for inbox, presence, handoff and call notifications.
- Acceptance: ledger reconciliation, tenant visibility and notification delivery tests.

### Phase 8 — Developer platform and additional channels
- Versioned REST API, scoped API keys, signed webhooks, replay protection and developer sandbox.
- Add Facebook Messenger and further provider adapters based on demand.
- Acceptance: API authorization, webhook replay, rate limit, version compatibility and security tests.

## Global safeguards and release gates

- Tenant identity comes from authenticated sessions or verified provider connections, never browser/model-supplied agency IDs.
- Encrypt provider credentials and media; redact secrets and sensitive message content from logs.
- Persist consent source, purpose, channel, scope and timestamp. Enforce suppression at send time, not only at campaign creation.
- Process STOP/START/HELP and equivalent provider keywords before AI processing.
- Enforce local marketing, do-not-call, calling-hour, sender-ID, number-registration and privacy requirements for every operating jurisdiction.
- Recording is disabled by default until consent/legal basis and jurisdiction policy are configured. Restrict playback and transcription by role; audit access and enforce retention/deletion.
- Human escalation remains available. AI cannot claim to be a human or bypass a requested human transfer.
- Use signature validation, replay protection, idempotency, bounded retries, dead-letter queues and provider outage circuit breakers.
- Separate queued, provider-accepted, delivered, failed, ringing, answered and completed states.
- Meter only well-defined provider events; do not treat queue insertion as delivery.
- Feature flags and additive migrations protect existing tenants and existing channels.
- Production enablement requires provider approval, verified credentials/numbers, compliance review, security tests, operational monitoring and rollback plan.

## Immediate execution order

1. Reconcile staging migration drift and establish a healthy release baseline.
2. Implement shared communication contracts and consent/suppression model.
3. Deliver SMS inbound/outbound vertical slice and two-way inbox.
4. Deliver voice inbound/outbound and AI receptionist with human transfer.
5. Continue Customer 360, campaigns, automation, contact-center, analytics/mobile and developer platform phases.

The architecture is approved; provider-specific production integration remains gated on vendor selection, account provisioning and credentials configured securely by an authorized administrator.


## Kenya-first SMS adapter decision
Use Africa's Talking as the first provider adapter for two-way SMS in Kenya. Its published support information lists two-way SMS in Kenya; Twilio's Kenya SMS guidelines currently list two-way SMS as unsupported. Keep the adapter interface provider-neutral so other markets can add different providers. See `docs/AFRICAS_TALKING_SMS_SETUP.md` for tenant connection fields, callback URLs and sandbox-to-production checklist.


## Kenya-first Voice adapter decision
Use Africa's Talking Voice for the first Kenya call integration. The adapter supports inbound/outbound call initiation, callback-driven VoiceXML, call status events and a configured human transfer destination. Request a regular voice-enabled number for two-way calling. Call recording remains disabled by default. See `docs/AFRICAS_TALKING_VOICE_SETUP.md`. Follow-on work includes dynamic agent queues, IVR, voicemail, missed-call callbacks and a real AI speech pipeline.
