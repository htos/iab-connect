# Multi-channel Messaging — Provider Setup (REQ-030 / Epic E5-S4)

This document explains how communication messages are delivered, and how to enable an
additional channel (SMS, WhatsApp) once a provider is chosen. It is operator-facing.

## How it works today

All outbound messages go through a small channel abstraction:

- `IMessageChannelSender` — one implementation per channel (`Email`, `Sms`, `WhatsApp`). Each
  exposes `Channel`, `IsEnabled`, and `SendAsync(MessageRequest)`.
- `IMessageDispatcher` — picks the enabled sender for a requested channel. If the requested
  channel is disabled, it **falls back to email** (when email is enabled), otherwise it returns a
  clear "skipped" result. It never crashes a caller.
- `IChannelPreferenceService` — the seam that decides which channel a given user's message should
  use (consent + preference + provider-availability). In E5-S4 this is a default
  "email-always-eligible" implementation; E5-S5 replaces it with the real per-user logic.

**Email is the always-enabled baseline.** `EmailChannelSender` delegates to the existing
`IEmailSender` (`SmtpEmailSender`, configured by the `Smtp` section — see
`backend/.env.example`). Existing workflows (email campaigns, event notifications) keep calling
`IEmailSender` directly and are unchanged. Only the **communication-automation send path**
(E5-S2) routes through the dispatcher today.

**SMS and WhatsApp ship as disabled stubs.** The channels exist in the abstraction and in
config, but **no provider adapter is implemented yet**. They are `IsEnabled = false` by default;
the dispatcher never routes to them while disabled, and invoking one directly raises a typed
`ChannelDisabledException` (which the dispatcher catches). If you set `*__Enabled = true` without
implementing an adapter, a send attempt fails fast with a clear `NotSupportedException` rather
than silently dropping the message.

## Config keys

Settings bind from configuration (`appsettings.json` carries only the disabled, non-secret
stanza; real values come from environment variables / Railway secrets — never source). Nested
keys use the `__` separator in environment variables.

| Key                     | Meaning                                              | Default |
| ----------------------- | ---------------------------------------------------- | ------- |
| `Sms__Enabled`          | Enable the SMS channel                               | `false` |
| `Sms__Provider`         | Provider key (e.g. `twilio`)                         | empty   |
| `Sms__AccountSid`       | Provider account id / SID (secret)                   | empty   |
| `Sms__AuthToken`        | Provider auth token (secret)                         | empty   |
| `Sms__FromNumber`       | Sender number, E.164 (e.g. `+41000000000`)           | empty   |
| `WhatsApp__Enabled`     | Enable the WhatsApp channel                          | `false` |
| `WhatsApp__Provider`    | Provider key                                         | empty   |
| `WhatsApp__AccessToken` | Cloud API access token (secret)                      | empty   |
| `WhatsApp__PhoneNumberId` | WhatsApp phone-number id                           | empty   |

The email channel reuses the existing `Smtp__*` keys (documented in `backend/.env.example`).

## Enabling a channel (extension point)

Adding a real channel is **closed-for-modification** with respect to the dispatcher and callers —
you only add an adapter + config:

1. **Implement the provider adapter.** Replace the relevant stub in
   `backend/src/IabConnect.Infrastructure/Messaging/` (`SmsChannelSender` /
   `WhatsAppChannelSender`) with a real implementation that drives the provider SDK behind an
   `IMessageProvider`. Map `MessageRequest` → the provider's API; return a `MessageSendResult`.
   `IsEnabled` should reflect the config flag.
2. **Supply secrets in the environment** (never in `appsettings.json`): set the provider keys
   above on your deployment target.
3. **Flip the flag**: `Sms__Enabled=true` (or `WhatsApp__Enabled=true`).

No change is needed to `IMessageDispatcher`, `IMessageChannelSender`, or any caller (e.g. the
automation dispatch engine). Provider-send retries reuse Hangfire where the caller is a job
(the automation dispatch job already retries on whole-run failure).

## Notes

- Provider credentials are configuration secrets — they never live in source. `appsettings.json`
  carries only the disabled, empty stanza.
- Delivery failures are isolated: a provider error is returned as a failed-send result that the
  caller records (e.g. the automation execution marks that recipient `Failed`), never an
  unhandled crash.
- The email transport (`System.Net.Mail.SmtpClient` with `EnableSsl`) does STARTTLS; see
  `docs/14_beta_railway_setup.md` and the `Smtp__*` keys for the email channel's own setup.
