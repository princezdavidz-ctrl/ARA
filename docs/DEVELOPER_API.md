# ARA Developer API

The ARA Developer API lets a company connect its own server-side application to its tenant's conversation inbox.

## Authentication

Create a key in **Company CRM → Developer API**. The full secret is shown once. Store it in a server-side secret manager and send it using:

```http
Authorization: Bearer YOUR_ARA_API_KEY
```

Never embed an API key in browser JavaScript, mobile apps, public repositories or customer-visible code. Revoke compromised keys immediately.

Keys currently support the `conversations:write` scope and expire after a selected period of 30, 90, 180 or 365 days.

## Environments

- Production: `https://ara-api-c525.onrender.com`
- Staging: `https://ara-api-staging.onrender.com`

Use staging keys with the staging API and production keys with production.

## Create a conversation

```http
POST /public/v1/conversations
Content-Type: application/json
Authorization: Bearer YOUR_ARA_API_KEY

{
  "channel": "web",
  "customerName": "Jane",
  "customerContact": "jane@example.com"
}
```

Supported channel values: `web`, `whatsapp`, `email`, `instagram`, `tiktok`, `other`.

The response includes the new conversation `id`. Keep it on your server.

## Submit an inbound customer message

```http
POST /public/v1/conversations/CONVERSATION_ID/messages
Content-Type: application/json
Authorization: Bearer YOUR_ARA_API_KEY

{
  "message": "I would like to know more about your services.",
  "idempotencyKey": "your-unique-message-reference"
}
```

The message is stored as an inbound customer message and queued for ARA's existing processing workflow. The optional idempotency key should be unique per company and message submission.

## Security and current limitations

- API keys are stored as SHA-256 hashes; the original secret is not stored or displayed again.
- Every request is restricted to the company that owns the API key.
- Revoked, expired or inactive-company keys are rejected.
- Key creation and revocation are written to the company audit log.
- This initial API supports conversation creation and inbound message submission. Read APIs, outbound delivery callbacks, configurable webhooks, finer-grained scopes and rate-limit controls are planned separately.
