# Africa's Talking SMS channel setup

ARA's first SMS adapter is Africa's Talking. This is the Kenya-first provider choice because its published country support lists Kenya SMS (including two-way) and Voice. Twilio's current Kenya SMS guidance says two-way SMS is not supported, although its Kenya voice guidance lists inbound and outbound calling. Provider coverage, sender IDs and account approval must still be confirmed in the provider account before live activation.

## Company connection fields

Create a channel connection as a company owner/admin:

- `provider`: `africas_talking_sms`
- `displayName`: a label such as `Kenya SMS`
- `externalAccountId`: the approved sender ID or shortcode configured with Africa's Talking
- `credentials.username`: Africa's Talking account username
- `credentials.apiKey`: account API key
- `credentials.environment`: `sandbox` or `production`
- `credentials.webhookVerifyToken`: a long, random secret generated specifically for this ARA connection (at least 32 random bytes)

ARA encrypts the credential object at rest with the existing `ARA_CHANNEL_ENCRYPTION_KEY`. Never paste provider keys into source code, issues or logs. Only owners/admins can create and activate channel connections.

After saving, activate the connection using the channel verification endpoint. Activation verifies required configuration is present; it does not prove sender-ID approval, account balance, callback reachability or a successful live send.

## Provider callbacks

Configure the incoming-message callback:

`POST https://<ARA_API_HOST>/webhooks/africas-talking/sms/incoming?token=<webhookVerifyToken>`

Configure the delivery-report callback:

`POST https://<ARA_API_HOST>/webhooks/africas-talking/sms/delivery-report?token=<webhookVerifyToken>`

Both callbacks must use HTTPS. The token is hashed in ARA's database and compared through the credential vault. Do not reuse the Meta webhook token or a public API key. Restrict access at the provider side where supported and rotate the token if exposed.

## Implemented behavior

- Inbound SMS creates/updates a tenant-scoped SMS conversation and is processed by the existing shared AI worker.
- Outbound SMS uses the existing message approval state, tenant quota reservation, bounded retries and delivery state tracking.
- Provider message IDs are stored; delivery callbacks reconcile `sent` to `delivered` or `failed`. Reports arriving before the send response are persisted and reconciled after the provider ID is recorded.
- Duplicate inbound callbacks are idempotent.
- STOP/UNSUBSCRIBE/CANCEL/END/QUIT suppress future non-system outbound SMS for that tenant/contact. START/UNSTOP/YES restores the subscription state. HELP returns the channel help response. These keyword acknowledgements can be delivered after STOP.
- Marketing campaigns must additionally require explicit, purpose-specific opt-in before sending. A prior inbound service message is not blanket marketing consent.

## Go-live checklist

1. Create/verify the Africa's Talking account and fund the account.
2. Obtain approval for the sender ID/shortcode and verify supported Kenyan network coverage.
3. Create a unique webhook token and add the connection through the company workspace.
4. Configure both callback URLs in the provider dashboard.
5. Use sandbox first; verify inbound, outbound, STOP, START, HELP and delivery reports.
6. Run a small authorized production pilot and reconcile provider dashboard charges against ARA usage.
7. Enable bulk campaigns only after explicit opt-in, quiet hours, frequency caps, suppression and opt-out audit controls are verified.

## API references

- Africa's Talking SMS API: https://developers.africastalking.com/docs/sms/overview
- Africa's Talking help and country availability: https://community.africastalking.com/forum/help-18238/
- Twilio Kenya SMS guidelines: https://www.twilio.com/en-us/guidelines/ke/sms
- Twilio Kenya voice guidelines: https://static1.twilio.com/en-us/guidelines/ke/kenya--voice-guidelines---twilio
