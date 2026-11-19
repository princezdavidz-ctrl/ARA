# ARA Staff Console and Human Support

## Staff web
The separate staff console is published from `apps/staff-console`. It uses the existing platform administrator authentication flow and accepts only the `super_admin` and `platform_support` roles for support operations.

- Staff sign-in: email + password, followed by the existing six-digit email OTP.
- A super administrator can create `platform_support` staff accounts from the Staff accounts page.
- New visitor requests are assigned to an online support agent with the lightest active queue. If nobody is online, the request remains in the waiting queue.
- Staff presence is refreshed every 30 seconds and expires after 90 seconds without a heartbeat.
- The console polls the inbox every five seconds and visitor chat updates every four seconds.
- Staff can claim waiting requests, reply, and resolve conversations. A staff member cannot take over another agent's assigned conversation; super administrators can oversee all requests.

## Public human handoff
The public ARA website assistant offers a Talk to a human action in English and Kiswahili. Visitors provide their name, email and initial message. A random visitor session token is returned once and stored in the browser session state; the database stores only its SHA-256 hash. Subsequent reads send the token in the `X-Support-Token` header, not in the URL.

Public support requests are rate-limited to five new requests per IP per minute. Messages are limited to 12,000 characters. A visitor can continue sending messages until staff resolves the conversation.

## Email delivery
Render Free web services block outbound SMTP ports 25, 465 and 587. The OTP email service now supports Resend over HTTPS.

Configure these Render backend environment variables:
- `RESEND_API_KEY`: Resend API key, stored as a secret.
- `ARA_AUTH_EMAIL_FROM`: sender address on a domain verified in Resend (for example, `security@your-verified-domain`).

Do not use `onboarding@resend.dev` for arbitrary customer recipients. Verify the sending domain in Resend and publish the DNS records Resend provides before using production OTP delivery. Existing SMTP configuration remains as a fallback when `RESEND_API_KEY` is not set.

## Deployment
The backend startup migration runner applies `025_staff_human_support.sql` after the earlier migrations. Deploy the backend before enabling the public human handoff or staff console.
