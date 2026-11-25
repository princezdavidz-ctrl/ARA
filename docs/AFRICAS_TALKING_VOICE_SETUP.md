# Africa's Talking Voice setup

ARA's first Kenya voice adapter uses Africa's Talking Voice. Its published country list includes Kenya, and its voice product supports inbound/outbound calling, IVR, call transfer and queues. ARA's first delivery provides call lifecycle tracking and a configured human-agent bridge. A full AI speech agent and dynamic staff queue are follow-on work packages, not implied by this initial adapter.

## Company connection fields

Create a channel connection in Company CRM > Integrations:

- `provider`: `africas_talking_voice`
- `externalAccountId`: the regular voice-enabled number allocated to the Africa's Talking application, in E.164 format (for example, `+2547XXXXXXXX`)
- `credentials.username`: Africa's Talking application username
- `credentials.apiKey`: application API key
- `credentials.environment`: `sandbox` or `production`
- `credentials.webhookVerifyToken`: unique random secret of at least 32 characters
- `credentials.transferNumber`: company-owned agent phone number in E.164 format

ARA encrypts these credentials at rest with `ARA_CHANNEL_ENCRYPTION_KEY`. Do not put credentials in source code, tickets or logs.

**Important:** request a regular voice-enabled number for inbound and outbound calling. Africa's Talking documentation describes restrictions on outbound calls for some virtualized numbers. Confirm number type, caller-ID and account provisioning with the provider before production use.

## Provider callbacks

Configure the phone number's VoiceXML callback URL:

`POST https://<ARA_API_HOST>/webhooks/africas-talking/voice/callback?token=<webhookVerifyToken>`

Configure the events URL:

`POST https://<ARA_API_HOST>/webhooks/africas-talking/voice/events?token=<webhookVerifyToken>`

Both URLs must be HTTPS. The webhook token is stored as a SHA-256 hash and resolves to one active tenant connection. Do not reuse the SMS token.

## Call behavior in this release

- Inbound call creates a tenant-scoped `phone` conversation and call record, then returns VoiceXML that announces the call and bridges it to the configured transfer number.
- Outbound call is initiated through `POST /platform/voice/calls` with `connectionId` and an E.164 `to` number. When the customer answers, the VoiceXML callback bridges the call to the configured agent transfer number.
- Call events update status, session ID, duration, provider cost and currency.
- Call history is available through `GET /platform/voice/calls`.
- Completed calls and call seconds are recorded in tenant usage metering.
- Call recording is disabled by default. ARA does not request recording in this release.

The configured transfer number is a single company destination, not yet an availability-aware staff queue. The next voice work package is dynamic staff routing, queue/IVR controls, voicemail, missed-call callbacks and the AI speech agent (speech-to-text, conversation orchestration and text-to-speech).

## Provider provisioning and operational notes

- Request and activate a regular voice-enabled number in the Africa's Talking dashboard; the provider may require an application review, agreement and invoice before allocating the number.
- Configure the callback and events URLs for the allocated number.
- Start with sandbox credentials and test inbound and outbound call lifecycle events before any production calls.
- Check current Kenyan number fees, per-minute rates, concurrency and account balance with Africa's Talking before setting customer prices. Provider wallet balance can affect service availability. The provider's current guidance recommends up to 40 simultaneous calls and one call initiation per second; ARA applies these as per-connection guardrails for outbound calls.
- Africa's Talking's help material says call recordings remain on its dashboard for 48 hours. If recording is enabled in a later release, ARA must download and store recordings securely within the provider's retention window, with lawful consent, role-based access and a defined deletion policy.

## API and provider references

- Africa's Talking Voice API: https://developers.africastalking.com/docs/voice/overview
- Voice onboarding and country availability: https://help.africastalking.com/en/collections/150771-voice
- Voice number request: https://help.africastalking.com/en/articles/13762314-voice-number-request-acquisition
- Voice call status fields: https://help.africastalking.com/en/articles/2948521-understanding-parameters-used-in-a-call
- Twilio Kenya Voice coverage (future alternative): https://static1.twilio.com/en-us/guidelines/ke/kenya--voice-guidelines---twilio
