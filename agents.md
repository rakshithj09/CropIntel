# CropIntel Engineering and Security Rules

This file defines non-negotiable engineering rules for any agent working in the CropIntel repository. Follow these rules for every code change, feature, fix, refactor, dependency update, API route, database change, deployment change, or documentation update.

If a requested change conflicts with this file, stop and explain the conflict. Do not weaken security, privacy, access control, or data handling to make a feature work faster.

## 0. Mandatory preflight

Before doing any repository task, the agent must:

1. Read this `agents.md` file from disk.
2. Treat these instructions as binding for the entire task.
3. If any user request conflicts with this file, stop and explain the conflict.
4. Do not rely only on prior memory or conversation context. Reread this file at the start of each new task.
5. Include confirmation in the final report that `agents.md` was checked.

## 1. Core operating rules

- Read the existing code before changing it.
- Preserve working features unless the requested change requires removal.
- Prefer the smallest safe change.
- Do not invent integrations, data sources, security controls, compliance status, or test results.
- Do not state that a feature is secure, private, compliant, production-ready, or complete unless the repository proves it.
- Do not hardcode secrets, access tokens, API keys, passwords, service-account JSON, private URLs, signing keys, or database credentials.
- Do not commit `.env.local`, `.env`, service-account files, private keys, model provider tokens, or downloaded user data.
- Do not copy production data into fixtures, logs, screenshots, commits, or documentation.
- Avoid adding dependencies. Add one only when the standard library or existing project dependencies do not solve the problem safely.
- Pin or lock dependencies through the package manager lockfile.
- Keep TypeScript strict. Avoid `any`, unsafe casts, ignored errors, and disabled lint rules.
- Do not disable security headers, auth checks, validation, rate limits, or logging to resolve a bug.
- Use clear names and short functions. Keep business logic out of UI components when possible.

## 2. Required workflow for every task

Before coding:

1. Identify data touched by the change.
2. Identify who is allowed to read, create, update, and delete that data.
3. Identify every trust boundary, including browser to API, API to database, API to model provider, user upload to storage, and admin tool to production data.
4. Identify input sources. Treat all user-controlled values as untrusted, including query parameters, headers, cookies, route parameters, form fields, file names, file metadata, uploaded images, database content, and third-party API responses.
5. Check whether the change adds privacy, security, cost, abuse, performance, or compliance risk.
6. Select the smallest safe design before implementing it.

While coding:

1. Validate input at the server boundary.
2. Authenticate the request before accessing protected data.
3. Authorize the specific action against the specific resource.
4. Rate-limit abuse-prone or expensive endpoints.
5. Return safe errors to users and detailed errors only to controlled server logs.
6. Add tests or a reproducible verification path for the security-sensitive behavior.

Before finishing:

1. Run formatting, linting, type checks, tests, and build steps that exist in the repository.
2. Review the diff for secrets, overly broad permissions, missing ownership checks, exposed internal details, and accidental data collection.
3. Report files changed, behavior changed, validation performed, unresolved risks, and required deployment configuration.

## 3. Secrets and environment variables

### Never expose secrets

The following values must never appear in browser bundles, `NEXT_PUBLIC_*` variables, client-side code, Git history, issue comments, logs, screenshots, or error responses:

- AI or model-provider API keys
- Firebase Admin credentials
- Service account JSON
- Private database URLs
- JWT signing keys
- Session signing keys
- Encryption keys
- Webhook signing secrets
- SMTP credentials
- Internal service URLs
- Third-party API tokens with write access

### Public keys

A value belongs in `NEXT_PUBLIC_*` only when it is designed to be public and restricted by the provider. For example, a browser Google Maps key may be public only when it uses strict website referrer restrictions and only grants required APIs.

### Required handling

- Read private configuration only on the server.
- Fail closed when required secrets are missing in production.
- Maintain `.env.local.example` with placeholder values only.
- Add new environment variables to documentation with purpose, scope, and where they are configured.
- Review deployment settings after adding an environment variable.
- Rotate a secret immediately if it appears in a commit, log, message, or client bundle.

## 4. Authentication and authorization

### Authentication

- Use the established authentication system. Do not create a parallel auth mechanism without approval.
- Verify identity on the server for every protected API request.
- Do not trust a user ID, email, role, farm ID, diagnosis ID, or ownership flag supplied by the browser.
- Do not store long-lived tokens in local storage unless the existing auth provider requires it and protects against XSS appropriately.
- Use secure, `HttpOnly`, `Secure`, and appropriate `SameSite` cookies for custom server sessions.
- Protect sign-in, sign-up, password reset, email verification, and token refresh endpoints with rate limits.

### Authorization

- Use deny-by-default access control.
- Enforce authorization on the server and in Firebase security rules. Client-side checks are only for user experience.
- Check ownership or membership before reading, updating, deleting, exporting, or sharing a farm, diagnosis, image, report, or user record.
- Verify organization or farm membership from trusted server-side data.
- Enforce role permissions explicitly. Do not infer admin access from a user-controlled field.
- Prevent insecure direct object references. A guessed ID must never grant access.
- Re-check authorization after sensitive state changes such as farm membership removal, role changes, account deletion, or ownership transfer.

### CropIntel access model

For user-owned resources, default to these rules unless the feature states otherwise:

- A user reads and changes only their own user profile.
- A farm owner manages farm metadata and membership.
- A farm member reads only records for farms they belong to.
- A diagnosis belongs to the user and farm recorded at creation time.
- A user accesses a diagnosis only if they own it or are an authorized member of its farm.
- Administrative access must use an explicit admin role verified on the server.

## 5. Firebase, database, and storage security

- Do not use open Firestore or Storage rules in production.
- Do not use `allow read, write: if true` outside a clearly isolated local emulator setup.
- Write and review Firestore rules for every new collection and subcollection.
- Write and review Storage rules for every new upload path.
- Validate document shape and required fields in trusted server code. Rules enforce access control but do not replace application validation.
- Restrict user writes so they cannot set owner IDs, roles, verification status, timestamps, billing fields, or administrative fields for another user.
- Prevent users from changing `ownerId`, `farmId`, `userId`, role fields, or status fields unless a trusted server action authorizes it.
- Validate pagination limits, query filters, sorting fields, and document IDs.
- Use server timestamps for security-relevant creation and update times.
- Do not expose database errors, query details, collection names, or internal IDs to end users unless needed for the feature.
- Keep Firebase Admin SDK server-only.

## 6. Input validation and output safety

### Validation

- Validate every API request with a schema at the server boundary. Use the repository’s validation library, such as Zod, when available.
- Use allowlists for enum-like values such as crop types, disease categories, roles, sort columns, and action names.
- Enforce minimum and maximum lengths, numeric ranges, object shapes, and array sizes.
- Reject unexpected fields for sensitive endpoints.
- Normalize input only when it does not weaken validation.
- Do not build database queries, shell commands, file paths, URLs, or prompts from unvalidated input.

### XSS prevention

- Do not use `dangerouslySetInnerHTML` unless there is no safer alternative and the content is sanitized with a proven HTML sanitizer.
- Do not inject user-controlled values into HTML, CSS, JavaScript, URLs, markdown, or SVG without context-appropriate escaping or validation.
- Prefer React text rendering over manual HTML generation.
- Validate redirect targets against an allowlist of internal paths or approved origins.
- Do not render stored user content as raw HTML.

### Injection prevention

- Use parameterized queries for SQL. Never concatenate SQL strings.
- For Firestore or NoSQL, validate query fields, operators, filters, document IDs, and values against allowlists.
- Never pass user input into shell commands. Avoid shell execution entirely.
- Do not evaluate user-provided JavaScript, JSON expressions, templates, regular expressions, or code.
- Avoid dynamic imports and file paths based on user input.

## 7. File and image upload rules

CropIntel accepts crop images. Treat every upload as hostile.

- Require authentication for uploads unless an explicitly approved anonymous flow exists.
- Rate-limit upload and diagnosis endpoints.
- Enforce request body and file size limits before expensive processing.
- Allow only needed image MIME types, such as JPEG, PNG, or WebP.
- Verify file signatures or decode the image server-side. Do not trust the MIME type or extension alone.
- Reject SVG, HTML, scriptable formats, archives, executables, and unsupported formats.
- Generate server-side file names. Do not use original file names as paths or object keys.
- Remove path separators, control characters, and unsafe characters from displayed file names.
- Store uploads outside executable paths.
- Scan or sanitize images when the deployment environment supports it.
- Strip unnecessary metadata, especially geolocation metadata, unless the user explicitly opts in and the product needs it.
- Use private-by-default storage paths and signed, short-lived download URLs when serving private images.
- Delete temporary files reliably after processing.
- Do not log image contents, full image URLs with signed tokens, or image metadata that identifies a user.

## 8. API design, AI usage, and rate limiting

### Server-only costly operations

- Keep AI/model calls, diagnosis inference, paid APIs, and privileged database operations behind server-side endpoints.
- Never send private model tokens or unrestricted provider credentials to the browser.
- Do not rely on hiding endpoint URLs. Users can inspect frontend code and network traffic.
- Require authentication before expensive inference or paid API calls unless an approved limited trial flow exists.
- Enforce user-level and IP-level limits when possible.
- Add payload limits, concurrency limits, and timeouts to expensive routes.
- Reject repeated identical requests when caching or idempotency prevents cost and abuse.
- Return `429 Too Many Requests` with a safe retry message and `Retry-After` when supported.
- Store rate-limit counters in a shared production-capable store when the app runs on more than one instance. In-memory limits do not protect a multi-instance deployment.
- Do not reveal exact provider quotas, token balances, internal endpoints, or model configuration in client responses.

### AI output safety

- Treat model output as untrusted data.
- Do not execute model output as code, HTML, SQL, shell commands, or configuration.
- Do not let model output bypass authorization or overwrite trusted data.
- Clearly label diagnosis output as informational, not a guaranteed agronomic recommendation.
- Include a safe escalation message for severe crop loss, pesticide use, or uncertain diagnosis, such as consulting a licensed agronomist or local extension service.
- Do not make pesticide application, dosage, or legal-use claims without validated crop, location, label, and current authoritative data.

## 9. Privacy and data minimization

### Data minimization

- Collect only data required for the feature.
- Do not collect precise location, farm address, photos, device information, or analytics by default when a less sensitive option works.
- Make optional data clearly optional.
- Avoid collecting data about minors unless the product and privacy policy explicitly support it.
- Do not send user photos, farm details, location, diagnosis history, or account data to a third party without a clear product need and user notice.

### Required privacy documentation

When the site collects personal data, maintain a Privacy Policy page linked in the footer and relevant account flows. Keep it accurate to the deployed system.

The policy must describe:

- Data collected
- Why data is collected
- Where data is stored
- Third parties that receive data
- How long data is retained
- How users request access, correction, export, or deletion
- How users delete their account and related data
- How users contact CropIntel about privacy
- Effective date and update process

Whenever the Privacy Policy content changes, update the policy's visible effective date in the page UI and any matching metadata or documentation in the same change.

Do not claim compliance with a law, certification, or framework unless the product has been reviewed and meets the applicable requirements.

### Retention and deletion

- Define retention behavior for accounts, diagnoses, uploaded images, logs, analytics, and backups.
- Provide a supported deletion path for user data.
- Ensure deletion removes or anonymizes linked data where technically and legally appropriate.
- Do not keep user data indefinitely without a documented reason.
- Avoid storing full request bodies, images, credentials, tokens, or personal data in logs.

## 10. Security headers, browser safety, and CORS

- Keep `poweredByHeader: false` enabled.
- Apply security headers across application routes.
- Maintain a restrictive Content Security Policy and update it only for required trusted origins.
- Use `X-Content-Type-Options: nosniff`.
- Use clickjacking protection with `frame-ancestors` in CSP and/or `X-Frame-Options` where appropriate.
- Use `Referrer-Policy` to reduce accidental URL data leaks.
- Use `Permissions-Policy` to disable browser features not required by the product.
- Use HSTS in production HTTPS environments.
- Do not use wildcard CORS for authenticated or private endpoints.
- Allow only required origins, methods, and headers.
- Do not reflect arbitrary `Origin` headers.
- Verify CSRF protections for cookie-authenticated state-changing requests.

## 11. Error handling, logging, and monitoring

- Return generic, actionable errors to users.
- Log detailed failures only on the server in a protected logging system.
- Never log passwords, credentials, access tokens, cookies, authorization headers, full payment information, raw uploaded files, or private diagnosis images.
- Redact personal identifiers when logging is necessary.
- Use stable error codes for support and debugging.
- Do not expose stack traces, database query errors, filesystem paths, internal hostnames, cloud account IDs, or source code details to users.
- Record security-relevant events, such as failed logins, authorization failures, admin actions, repeated rate-limit hits, and unexpected upload failures, without storing sensitive payloads.

## 12. Dependencies and supply chain safety

- Check existing dependencies before adding a new package.
- Prefer mature, actively maintained libraries from known publishers.
- Avoid packages that duplicate small utility code or add large transitive dependency trees.
- Review package scripts before adding a dependency.
- Run the repository’s dependency audit process after dependency changes.
- Upgrade vulnerable dependencies when a safe compatible update exists.
- Do not use unmaintained packages for auth, cryptography, sanitization, or file parsing.
- Do not disable package-manager integrity checks.
- Keep lockfiles committed and consistent.

## 13. Testing requirements

For every security-sensitive change, add or run tests that prove the intended behavior.

Minimum test cases when applicable:

- Unauthenticated request is rejected.
- Authenticated but unauthorized user is rejected.
- Authorized user succeeds.
- Input validation rejects malformed, oversized, or unexpected fields.
- A user cannot access another user’s resource by changing an ID.
- Upload validation rejects invalid type, invalid signature, oversized file, and unsafe name.
- Rate limiting returns `429` after the configured threshold.
- Error response does not expose stack traces or secrets.
- CSP/CORS behavior still supports required site functionality and blocks unapproved origins.

## 14. Deployment rules

- Use HTTPS in production.
- Configure production environment variables only through the deployment platform’s secret manager.
- Confirm development-only settings are disabled in production.
- Confirm source maps, debug routes, test accounts, mock endpoints, and verbose logging do not expose sensitive information in production.
- Confirm Firebase, cloud, maps, and AI-provider keys have the narrowest restrictions available.
- Configure domain restrictions for browser-visible Google Maps keys.
- Configure backend credentials with least privilege.
- Confirm rate limiting works in the production hosting model.
- Confirm databases and storage deny unauthenticated access unless a documented public use case exists.

## 15. Prohibited shortcuts

Never do any of the following:

- Put a private key in `NEXT_PUBLIC_*`.
- Trust a client-supplied user ID or role.
- Disable Firestore or Storage rules for convenience.
- Use `allow read, write: if true` in production.
- Use raw SQL string concatenation.
- Use `dangerouslySetInnerHTML` for unsanitized content.
- Store passwords or raw reset tokens.
- Expose AI provider keys in frontend code.
- Skip rate limits on paid or expensive endpoints.
- Disable CSP, CORS restrictions, auth, validation, or ownership checks to fix a bug.
- Log complete requests containing private data.
- Say an endpoint is "hidden" as a security measure.
- Claim OWASP compliance without a scoped, evidence-based review.

## 16. Completion report template

At the end of each task, provide this report:

```text
AGENTS.md:
- Read before work: [Yes/No]

Changed:
- [file]: [what changed]

Security and privacy review:
- Data touched: [list]
- Authentication: [how verified]
- Authorization: [how ownership or role was checked]
- Validation: [schemas or checks added]
- Rate limits: [route and threshold]
- Secrets: [confirmation that no secret entered client code]
- Privacy impact: [data collected, stored, shared, or none]

Verification:
- [command or test]: [result]
- [manual test]: [result]

Remaining risks or follow-up:
- [specific risk, configuration step, or "None identified"]
```

## 17. Current project-specific reminders

- CropIntel uses Next.js and has security middleware and server-side validation utilities. Reuse and improve these utilities rather than creating scattered duplicate security code.
- Keep `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` limited to browser-safe Maps usage. Restrict the key by approved website referrers and only required Google APIs.
- Treat crop photos, diagnosis history, farm addresses, and coordinates as potentially sensitive user data.
- A crop diagnosis feature must not expose private model keys or unrestricted inference endpoints to the browser.
- Any future Firebase integration requires reviewed Firestore and Storage rules before deployment.
- Any future account, farm, or diagnosis collection requires explicit ownership and membership rules before release.
