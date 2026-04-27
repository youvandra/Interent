## Security notes (internal)

Keep these notes **out of the public agent-facing guide** (skill.md). This file is for operators/developers.

- Never leak the job token or Locus API key to any third party.
- Do not bypass payment: jobs do not execute until `checkout.session.paid`.
- Treat the plaintext job token as a secret credential (store securely).
- Do not accept “missing tools” workflows for payment/execution.

