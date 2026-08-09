# SOGo 6 — Feature Roadmap

## Overview

This repository has implemented the full SOGo 6 roadmap and added significant new capability (SSO, MFA, sharing, CardDAV, observability). This document captures the next wave of features to consider across all areas of the groupware suite.

**Legend:** Priority labels ranked by strategic value.

| Label | Meaning |
|-------|---------|
| `[t0]` | **Tier 0 — Foundation.** Highest impact, unlocks other features. Core to product identity |
| `[t1]` | **Tier 1 — Core Experience.** Visible daily to all users. UX parity with modern groupware |
| `[t2]` | **Tier 2 — Admin & Scale.** Operational excellence, growth infrastructure, compliance |
| `[t3]` | **Tier 3 — Ecosystem.** Platform integration play. Strategic partnerships (OpenCloud, Nubus) |
| `[t4]` | **Tier 4 — Team & Productivity.** Collaboration enhancements beyond email |
| `[t5]` | **Tier 5 — AI & Intelligence.** ML-powered features using local models |
| `[t6]` | **Tier 6 — Vertical Markets.** Sector-specific (healthcare, education, government, non-profit) |
| `[t7]` | **Tier 7 — Advanced / Long-Term.** High effort, speculative, or dependency-heavy |

---

## Priority Ranking (All Sections)

### Tier 0 — Foundation (do these first)

| # | Feature | Section | Rationale |
|---|---------|---------|-----------|
| 1 | **CalDAV Sync** | 6 | Complements existing CardDAV; unlocks full calendar ecosystem for desktop/mobile clients |
| 2 | **Shared Mailboxes** | 11 | Most requested team feature; team@, support@ workflows. High visibility, moderate effort |
| 3 | **Resource Booking** | 2 | Classic SOGo differentiator; meeting rooms, equipment. Core enterprise requirement |
| 4 | **Team Calendars** | 2 | Group-owned calendars with ACLs — natural extension of existing sharing engine |
| 5 | **Sieve Editor UI** | 5 | Visual filter builder. Completes the mail rules story, high admin value |
| 6 | **DKIM/DMARC/SPF Wizard** | 5 | Every deployment needs this; DNS record generator + validator |
| 7 | **WebAuthn / Passkeys** | 7 | Passwordless auth, modern security standard, high trust signal |
| 8 | **API Playground (Swagger UI)** | 22 | Developer onboarding; enables ecosystem growth |

### Tier 1 — Core Experience

| # | Feature | Section | Rationale |
|---|---------|---------|-----------|
| 9 | **Conversation View** | 1 | Threaded email is table-stakes for modern webmail |
| 10 | **Calendar Subscriptions** | 2 | Subscribe to external iCal feeds; essential for hybrid calendar workflows |
| 11 | **Working Hours / Location** | 2 | Permeates calendar, scheduling, free/busy — foundational data model |
| 12 | **Undo Send** | 1 | Low effort, high gratitude. Safety net for composed emails |
| 13 | **Schedule Send** | 1 | Compose now, deliver later. Expected in any modern mail client |
| 14 | **Email Snooze** | 1 | Temporarily remove from inbox, reappear later. High user satisfaction |
| 15 | **Push Notifications (WebPush)** | 3 | Real-time browser/mobile. VAPID keys, Service Worker |
| 16 | **Global Quick Search (Cmd+K)** | 4 | Unified search across mail, contacts, calendar, settings |
| 17 | **PWA / Mobile Web** | 6 | Mobile reach without native app. Offline cache, share target |
| 18 | **Keyboard Shortcuts** | 10 | Gmail-style j/k/e/r/a, customizable, cheat sheet overlay |
| 19 | **PGP End-to-End Encryption** | 1 | Privacy flagship; key generation, WKD discovery, sign/encrypt/decrypt |
| 20 | **Follow-Up Flags** | 1 | Flag emails with due dates and notifications. Personal productivity |
| 21 | **Quick Reply Templates** | 1 | Canned responses with variable substitution |
| 22 | **Drag-and-Drop Attachments** | 10 | Drop files into compose, events, contacts |

### Tier 2 — Admin & Scale

| # | Feature | Section | Rationale |
|---|---------|---------|-----------|
| 23 | **Helm Chart / Kubernetes** | 14 | Production-grade K8s deployment with HPA, PVC, ingress |
| 24 | **Audit Log** | 5 | Tamper-proof admin/user action log with SIEM export |
| 25 | **Backup Automation** | 5 | DB dump + mailstore + config, retention, S3 target |
| 26 | **Pre-built Grafana Dashboards** | 13 | Production dashboards for throughput, activity, resources |
| 27 | **Multi-Tenant Branding** | 5 | Per-domain login page, logo, colors, CSS |
| 28 | **API Tokens** | 5 | Scoped, expiring bearer tokens for automation |
| 29 | **WebSocket Live Updates** | 3 | Real-time UI without polling |
| 30 | **Migration Tools** | 5 | Import wizards from G Suite / M365 / Dovecot / Cyrus |
| 31 | **Bulk User Management** | 5 | CSV import/export, domain-level ops, LDAP sync triggers |
| 32 | **Usage Quotas** | 5 | Per-user mailbox size, calendar/contact limits |
| 33 | **System Health Dashboard** | 5 | At-a-glance status of all services, storage, queues |
| 34 | **Database Migration UI** | 5 | Schema version tracking, run/rollback via admin panel |
| 35 | **Mailbox Debug Panel** | 22 | Raw email source, Sieve trace, IMAP session log |
| 36 | **Configuration as Code** | 30 | Gitops-ready immutable config, version-controlled |

### Tier 3 — Ecosystem & Integration

| # | Feature | Section | Rationale |
|---|---------|---------|-----------|
| 37 | **OpenCloud Integration (via nubusintercom)** | 8 | Strategic: file picker in compose, save attachments, calendar file links. Leverages existing OIDC + Redis |
| 38 | **nubusintercom Service Deployment** | 8 | Package nubusintercom as Docker companion; OIDC token exchange proxy between SOGo and OpenCloud |
| 39 | **Keycloak Identity Provider Co-deployment** | 8 | Optional Keycloak container pre-configured for SOGo + OpenCloud + nubusintercom |
| 40 | **Univention Nubus Portal Integration** | 8 | Embed SOGo as Nubus portal app alongside OpenCloud, Matrix |
| 41 | **Webhook System** | 8 | Outbound webhooks for n8n/Make/automation |
| 42 | **Document Preview** | 8 | In-browser PDF, Office docs via Collabora/OnlyOffice |
| 43 | **OpenCloud/Nextcloud File Picker Widget** | 22 | Dashboard + compose sidebar for quick file attachment via nubusintercom |
| 44 | **OpenID Connect Provider** | 8 | SOGo becomes OIDC IdP for other self-hosted services |
| 45 | **OAuth2 Provider** | 8 | Let third-party apps authenticate via SOGo |

### Tier 4 — Team & Productivity

| # | Feature | Section | Rationale |
|---|---------|---------|-----------|
| 46 | **Scheduling Polls** | 2 | "When are you free?" polls for internal/external participants |
| 47 | **Appointment Slots** | 2 | Publish bookable slots (Calendly-style) |
| 48 | **Free/Busy Lookup UI** | 2 | Visual attendee schedule overlay when creating events |
| 49 | **Collaborative Drafts** | 11 | Share draft emails for review before sending |
| 50 | **Approval Workflows** | 11 | Email-based approval chains (purchase orders, announcements) |
| 51 | **Email-based Helpdesk / Ticketing** | 11 | Auto-create tickets from emails, assignment, SLA tracking |
| 52 | **File Sharing** | 11 | Link-based file sharing (MinIO), expiration, password, tracking |
| 53 | **CRM-light** | 11 | Contact interaction history, email-to-account association |
| 54 | **Workflow Builder (Visual)** | 31 | Low-code: "If email from X and subject Y → forward, create event, notify" |
| 55 | **Custom Actions / Quick Actions** | 31 | User-defined multi-step actions as one click |

### Tier 5 — AI & Intelligence

| # | Feature | Section | Rationale |
|---|---------|---------|-----------|
| 56 | **Email Summarization** | 9 | TL;DR button for long threads. High visibility, moderate ML complexity |
| 57 | **Smart Email Classification** | 9 | Auto-label: newsletter, invoice, notification, personal. Core ML feature |
| 58 | **AI Draft Assistant** | 9 | Reply suggestions, tone adjustment, translation via local LLM |
| 59 | **Natural Language Search** | 9 | "Show invoices from March over $500" → structured query |
| 60 | **Smart Calendar Scheduling** | 9 | AI-suggested meeting times based on patterns and priorities |
| 61 | **Anomaly Detection (User)** | 9 | Flag unusual sending patterns: bulk email, odd hours, new recipients |
| 62 | **Contact Auto-Enrichment** | 9 | Extract phone, title, company from email signatures |
| 63 | **Smart Attachment Actions** | 9 | Auto-detect document type → suggest save/forward/archive |
| 64 | **Intelligent Spam Filtering** | 9 | Local ONNX model complementing Rspamd |
| 65 | **Meeting Transcript & Summary** | 9 | Whisper/STT → save notes to calendar event |

### Tier 6 — Vertical Markets (targeted)

| # | Feature | Section | Rationale |
|---|---------|---------|-----------|
| 66 | **SCIM Provisioning** | 27 | Enterprise identity lifecycle; auto-provision from Azure AD, Okta |
| 67 | **Student Group Management** | 18 | Edu: auto-provision from SIS/LDAP, term expiry, mailing lists |
| 68 | **HIPAA Compliance Mode** | 19 | Healthcare: enhanced audit, auto-encryption, BA templates |
| 69 | **eIDAS / Qualified Signatures** | 20 | Government: legally binding email signatures |
| 70 | **Donor Communication Management** | 21 | Non-profit: segmented email, tracking, recurring reminders |
| 71 | **Volunteer Scheduling** | 21 | Non-profit: shift calendars, swaps, availability collection |

### Tier 7 — Advanced / Long-Term

| # | Feature | Section | Rationale |
|---|---------|---------|-----------|
| 72 | **PST/M365 Import/Export** | 26 | Customer acquisition; migration from closed platforms |
| 73 | **Built-in Chat (Matrix)** | 16 | Full team chat integration; major scope |
| 74 | **JMAP Support** | 6 | Modern email protocol (RFC 8620); efficient sync, push |
| 75 | **ActiveSync (EAS)** | 6 | Native iOS/Android mail; legally complex protocol |
| 76 | **Native Mobile App** | 6 | React Native/Flutter; major investment |
| 77 | **Geo-Redundancy** | 30 | Active-passive across data centers; high infrastructure cost |
| 78 | **Post-Quantum Cryptography** | 32 | Hybrid PQ/Traditional encryption; future-proofing |
| 79 | **ActivityPub / Fediverse** | 17 | Decentralized calendar/contact sharing |
| 80 | **AR/VR Calendar** | 32 | Spatial calendar in WebXR; experimental |
| 81 | **Brain-Computer Interface** | 32 | Compose email via EEG; speculative |

---

## Detailed Feature Sections

### 1. Communication & Collaboration

| Feature | Priority | Description |
|---------|----------|-------------|
| **PGP End-to-End Encryption** | `[t1]` | Web key generation, public key management, sign/encrypt/decrypt in compose view, key discovery via WKD/keyservers |
| **S/MIME Support** | `[t7]` | Certificate-based email signing & encryption, PKCS#12 import, CA trust store |
| **Mail Delegation** | `[t1]` | Delegate mailbox access (send-as, read, manage) to other users, shared mail folders |
| **Vacation Message UI** | `[t4]` | Rich editor for vacation/out-of-office autoreplies beyond basic Sieve rules |
| **Spam Reporting UI** | `[t4]` | Mark as spam/ham, per-user Bayesian training, Rspamd integration dashboard |
| **Undo Send** | `[t1]` | Configurable grace period after send (5-30s) to recall an email |
| **Schedule Send** | `[t1]` | Compose now, deliver later at a chosen date/time |
| **Email Snooze** | `[t1]` | Temporarily remove from inbox, reappear at chosen time |
| **Follow-Up Flags** | `[t1]` | Flag emails for follow-up with due dates and notifications |
| **Quick Reply Templates** | `[t1]` | Save and insert canned responses; variable substitution ({{name}}, {{date}}) |
| **Conversation View** | `[t1]` | Proper threaded conversation view grouping sent+received by subject |
| **Read Receipts** | `[t4]` | Request and respect MDN read-receipt headers; UI to manage outgoing receipts |
| **Priority Inbox** | `[t5]` | Automatic classification into Important / Unread / Everything tabs |
| **Unified Inbox** | `[t2]` | Aggregate multiple mail accounts (IMAP) into a single unified view |

## 2. Calendar & Scheduling

| Feature | Priority | Description |
|---------|----------|-------------|
| **Resource Booking** | `[t0]` | Meeting rooms, equipment, vehicles as calendar resources with double-booking prevention, approval workflows |
| **Public Calendar Publishing** | `[t4]` | Publish iCal feeds publicly (read-only), embeddable widget for external sites |
| **Calendar Subscriptions** | `[t1]` | Subscribe to external iCal/CalDAV calendars with auto-refresh |
| **Free/Busy Lookup UI** | `[t4]` | Side-by-side visual overlay of attendees' schedules when creating events |
| **Recurring Event Exceptions** | `[t2]` | UI for editing single occurrences of recurring events |
| **Team Calendars** | `[t0]` | Group-owned calendars (not user-owned) that team members can contribute to |
| **Scheduling Polls** | `[t4]` | Send "When are you free?" polls to internal/external participants |
| **Calendar Heatmap** | `[t4]` | Visual analytics of meeting density, focus time availability, weekly patterns |
| **Working Hours / Location** | `[t1]` | Per-user working hours, timezone, default meeting location preferences |
| **Appointment Slots** | `[t4]` | Publish bookable time slots (like Calendly) that external people can claim |
| **Event Attachments** | `[t4]` | Attach files/agenda to calendar events (stored in MinIO or integrated file service) |
| **Weather Integration** | `[t7]` | Show weather forecast for event location on day view |
| **Birthday Calendar** | `[t4]` | Auto-generated calendar from contact birthdays |
| **iCal Feed Import Monitoring** | `[t2]` | Monitor external iCal feeds for changes and sync automatically |

## 3. Notifications & Real-Time

| Feature | Priority | Description |
|---------|----------|-------------|
| **Push Notifications (WebPush)** | `[t1]` | Real-time browser/mobile notifications for new mail, calendar reminders, task due dates via VAPID |
| **Email Notifications** | `[t4]` | Configurable email alerts for calendar invites, task assignments, share requests |
| **Unified Activity Feed** | `[t4]` | In-app feed showing recent activity across mail, calendar, contacts, shares |
| **Desktop Notification Preferences** | `[t2]` | Granular per-channel control (new mail, reminders, invites, admin announcements) |
| **Notification Digest** | `[t4]` | Daily/weekly summary digest of missed notifications sent via email |
| **Do Not Disturb** | `[t1]` | Quiet hours with automatic suppression of non-critical notifications |
| **WebSocket Live Updates** | `[t2]` | Real-time UI updates for new mail, calendar changes, contact updates without polling |

## 4. Search & Discovery

| Feature | Priority | Description |
|---------|----------|-------------|
| **Elasticsearch Integration** | `[t2]` | Full-text search across email bodies, calendar events, contacts. Index pipeline, search-as-you-type, advanced filters |
| **Advanced Mail Search** | `[t2]` | Structured query builder (date range, attachments, size, folder scope), saved searches |
| **Vector Search** | `[t5]` | Semantic / meaning-based email search using embeddings |
| **Global Quick Search** | `[t1]` | Unified search bar (Cmd+K) searching mail, contacts, calendar, users, settings simultaneously |
| **Saved Search Folders** | `[t4]` | Virtual folders that persist search criteria and auto-populate |
| **Attachment Search** | `[t2]` | Index and search attachment file names and contents (PDF, Office, text) |

## 5. Admin & Operations

| Feature | Priority | Description |
|---------|----------|-------------|
| **Sieve Editor UI** | `[t0]` | Visual drag-and-drop Sieve filter editor in admin panel, rule ordering, condition builder |
| **Multi-Tenant Branding** | `[t2]` | Per-domain login page, logo, colors, custom CSS (extension of existing theme system) |
| **Audit Log** | `[t2]` | Tamper-proof log of admin actions, user logins, permission changes — SIEM export in JSON/Syslog |
| **Backup Automation** | `[t2]` | One-command DB dump + mailstore snapshot + config archive, retention policy, S3 target |
| **API Tokens** | `[t2]` | Bearer token auth for automation and third-party integrations (scoped, expiring, rate-limited) |
| **Usage Quotas** | `[t2]` | Per-user mailbox size, calendar/contact count limits, admin alert thresholds |
| **Database Migration UI** | `[t2]` | Track schema versions, run/rollback migrations via admin panel |
| **DKIM/DMARC/SPF Configuration Wizard** | `[t0]` | Guided setup of email authentication records, DNS record generator, validation tests |
| **System Health Dashboard** | `[t2]` | At-a-glance status of all services, storage usage, queue depths, recent errors |
| **Bulk User Management** | `[t2]` | CSV import/export of users, domain-level operations, LDAP sync triggers |
| **Migration Tools** | `[t2]` | Import wizards from G Suite / M365 / Dovecot / Cyrus — IMAP-sync, mailbox format converters |
| **White-Label / Reseller Portal** | `[t2]` | Domain reseller can manage their own users, quotas, branding without full admin access |
| **Anomaly Detection** | `[t5]` | Flag unusual login locations, bulk mailbox access, credential stuffing attempts |
| **Custom Reports & Analytics** | `[t2]` | Scheduled export of usage statistics (active users, storage, mailbox growth) |
| **Service Auto-Healing** | `[t2]` | Health-check based service restart, dead letter queue monitoring, auto-remediation |
| **Domain-wide Mail Aliases** | `[t2]` | Catch-all, distribution groups, alias domains management |

## 6. Client & Sync

| Feature | Priority | Description |
|---------|----------|-------------|
| **CalDAV Sync** | `[t0]` | Bi-directional calendar sync for Apple/Thunderbird/Android clients (complements existing CardDAV) |
| **ActiveSync (EAS)** | `[t7]` | Exchange ActiveSync protocol for native mobile mail/calendar/contacts on iOS/Android |
| **JMAP Support** | `[t7]` | Modern JSON-based email protocol (RFC 8620-8621) — efficient sync, push, mailbox management |
| **PWA / Mobile Web** | `[t1]` | Installable PWA with offline cache, mobile-optimized navigation, share target, home screen icon |
| **Import/Export** | `[t2]` | .eml/.mbox import, vCard/iCal bulk export, PST export, Maildir/mbox migration |
| **IMAP IDLE / Push** | `[t1]` | Real-time IMAP push for desktop clients (Thunderbird, Apple Mail) — reduced polling latency |
| **Offline Mail** | `[t1]` | Service Worker cache for recently viewed emails, offline compose with send queue |
| **Native Mobile App** | `[t7]` | React Native or Flutter companion app for native push, camera, biometrics, offline |

## 7. Security & Compliance

| Feature | Priority | Description |
|---------|----------|-------------|
| **WebAuthn / Passkeys** | `[t0]` | Passwordless authentication via platform authenticators (Touch ID, Windows Hello, security keys) |
| **Session Management UI** | `[t2]` | View and revoke active sessions per user, device fingerprinting, IP/geolocation tracking |
| **Data Retention Policies** | `[t2]` | Auto-delete old mail/events per configurable policy (GDPR/Tax compliance) |
| **Encryption at Rest** | `[t7]` | Transparent DB/mailstore encryption, key management integration (Hashicorp Vault) |
| **Information Barriers** | `[t6]` | Prevent communication between defined user groups (legal/compliance segregation) |
| **Legal Hold** | `[t6]` | Immutable preservation of specified mailboxes/calendars for eDiscovery |
| **DLP Rules** | `[t6]` | Content inspection and policy enforcement (credit card, PII detection, attachment restrictions) |
| **Data Classification** | `[t6]` | User-applied sensitivity labels (internal/confidential/restricted) with policy enforcement |
| **Self-Service Password Reset** | `[t1]` | End-user password reset without admin involvement (extends existing rate-limited SMTP relay) |

## 8. Ecosystem & Integration

| Feature | Priority | Description |
|---------|----------|-------------|
| **Webhook System** | `[t3]` | Outbound webhooks on mail received, event created, user action — for automation chains (n8n, Make) |
| **Matrix/IRC Gateway** | `[t7]` | Bridge notifications or calendar invites into Matrix/IRC rooms |
| **Plugin System** | `[t7]` | Extensible plugin architecture for server (Flblueprints) and UI (remote component registry), SDK |
| **Nextcloud Integration** | `[t3]` | File attachments via Nextcloud, calendar/contact sync, Talk notification channel |
| **OpenCloud Integration (via nubusintercom)** | `[t3]` | Seamless file attachment picker from OpenCloud in compose view, save attachments to OpenCloud, link calendar events to OpenCloud files — via nubusintercom reverse auth proxy (OIDC token exchange between SOGo and OpenCloud using shared Keycloak/OIDC provider and Redis session store). Leverages existing OIDC SSO and Redis infrastructure |
| **nubusintercom Service Deployment** | `[t3]` | Package nubusintercom as a companion Docker service: OIDC token exchange proxy between SOGo and OpenCloud/Nextcloud. Shared Keycloak IdP, Redis-backed silent auth, file picker UI extension in compose and calendar views |
| **OAuth2 Provider** | `[t3]` | Let third-party apps authenticate via the groupware's own OAuth2 server |
| **Zapier / n8n Connector** | `[t3]` | Pre-built connector for no-code automation: trigger on new mail, action: create event |
| **Univention Nubus Portal Integration** | `[t3]` | Embed SOGo 6 as a portal app in Univention Nubus (Nubus for Kubernetes). Single sign-on via shared Keycloak/OIDC, unified app launcher, cross-app navigation alongside OpenCloud, Matrix, and other Nubus apps |
| **Keycloak Identity Provider Co-deployment** | `[t3]` | Package Keycloak as an optional companion service for unified identity management across SOGo, OpenCloud, and nubusintercom. Pre-configured OIDC clients, LDAP user federation with existing OpenLDAP, theme customization |
| **Mattermost / Zulip Integration** | `[t4]` | Calendar alerts, mail notifications, task reminders in team chat |
| **Document Preview** | `[t3]` | In-browser preview of attached PDF, Office docs, images (Collabora Online / OnlyOffice) |
| **Invoice / Receipt Processing** | `[t5]` | AI-assisted extraction of invoice data from email attachments, expense categorization |
| **OpenID Connect Provider** | `[t3]` | Become an OIDC identity provider for other self-hosted services |

## 9. AI & Intelligence

| Feature | Priority | Description |
|---------|----------|-------------|
| **Smart Email Classification** | `[t5]` | ML-based auto-labeling (newsletter, notification, invoice, personal) using local LLM or ONNX |
| **AI Draft Assistant** | `[t5]` | Generative AI compose assist: reply suggestions, tone adjustment, summarization, translation |
| **Smart Calendar Scheduling** | `[t5]` | AI-suggested meeting times based on attendee patterns, priorities, and focus time |
| **Intelligent Spam Filtering** | `[t5]` | Local ML model (DistilBERT/ONNX) for personalized spam detection complementing Rspamd |
| **Email Summarization** | `[t5]` | TL;DR button — generate short summaries of long email threads |
| **Contact Auto-Enrichment** | `[t5]` | Auto-extract phone, title, company from email signatures; suggest contact creation |
| **Smart Attachment Actions** | `[t5]` | Auto-detect document type (invoice, contract, form) and suggest save/forward/archive |
| **Meeting Transcript & Summary** | `[t5]` | Integrate with Whisper/STT for virtual meeting transcription, auto-save notes to event |
| **Anomaly Detection (User)** | `[t5]` | Flag unusual sending patterns (bulk email, odd hours, new recipients) indicating account compromise |
| **Natural Language Search** | `[t5]` | "Show me invoices from March over $500" → structured query execution |

## 10. Productivity & UX

| Feature | Priority | Description |
|---------|----------|-------------|
| **Keyboard Shortcuts** | `[t1]` | Gmail-style navigation (j/k, e, r, a), customizable keybindings, cheat sheet overlay |
| **Custom Themes (Per-User)** | `[t4]` | Extends existing theme system — users can customize their own appearance independently of admin |
| **Layout Presets** | `[t4]` | Split pane density options (comfortable/compact), sidebar width, column visibility |
| **Drag-and-Drop Attachments** | `[t1]` | Drop files directly into compose, calendar events, contact photos |
| **Integrated Document Editing** | `[t7]` | Edit Office documents in-browser via Collabora Online / OnlyOffice integration |
| **Markdown in Compose** | `[t4]` | Write emails in Markdown with live preview, convert to HTML on send |
| **Inline Translation** | `[t5]` | Translate emails or calendar events inline (DeepL/LibreTranslate integration) |
| **QR Code Sharing** | `[t4]` | Generate QR codes for contact info, event details, free/busy links |
| **Focus Mode** | `[t1]` | Minimal compose view without distractions, full-screen reading |
| **Sound Notifications (Custom)** | `[t4]` | Per-event-type notification sounds, upload custom audio files |

## 11. Team Collaboration

| Feature | Priority | Description |
|---------|----------|-------------|
| **Shared Mailboxes** | `[t0]` | Team mailboxes (support@, info@) with assignment, internal notes, collision detection |
| **Collaborative Drafts** | `[t4]` | Share draft emails with colleagues for review before sending |
| **Approval Workflows** | `[t4]` | Email-based approval chains: draft → manager approval → send (purchase orders, announcements) |
| **Email-based Helpdesk / Ticketing** | `[t4]` | Support ticket system from emails: auto-create tickets, assignment, status tracking, SLA |
| **CRM-light** | `[t4]` | Contact interaction history, deal pipeline tracking, email-to-account association |
| **Team Notes** | `[t7]` | Shared Markdown documents with real-time collaboration (integrate HedgeDoc / CodiMD) |
| **File Sharing** | `[t4]` | Share files via link (powered by MinIO), expiration dates, password protection, download tracking |

## 12. Performance & Scalability

| Feature | Priority | Description |
|---------|----------|-------------|
| **Mailbox Sharding** | `[t7]` | Distribute mailboxes across multiple backend servers for horizontal scaling |
| **Background Job Queue (Celery)** | `[t2]` | Async processing for expensive operations (import, export, index, bulk operations) |
| **CDN for Attachments** | `[t7]` | Serve static attachments via CDN or object storage to offload app server |
| **Virtual Scrolling** | `[t2]` | Efficient rendering of large mail folders (50k+) via windowed/virtual list |
| **Database Read Replicas** | `[t7]` | Route read queries to replicas, writes to primary for PostgreSQL scale |
| **Connection Pool Optimization** | `[t2]` | Fine-tuned pgBouncer/connection pooling config for high concurrency |
| **Lazy Loading** | `[t2]` | Defer loading of preview pane, attachment metadata, contact photos until needed |
| **Response Caching** | `[t2]` | Redis-cached API responses for frequently accessed data (settings, themes, contacts) |

## 13. Monitoring & Observability

| Feature | Priority | Description |
|---------|----------|-------------|
| **Pre-built Grafana Dashboards** | `[t2]` | Production-ready dashboards for mail throughput, user activity, system resources, error rates |
| **Structured Alerting Rules** | `[t2]` | Prometheus alert rules for disk space, service health, queue depth, auth failures |
| **SLA Tracking** | `[t2]` | Track uptime, API response times, mail delivery latency for service commitments |
| **User Activity Analytics** | `[t2]` | Dashboard for login frequency, active users, top features, adoption trends |
| **Email Flow Monitoring** | `[t2]` | Track delivery latency from SMTP → Sieve → IMAP, detect queue buildup |
| **Distributed Tracing** | `[t7]` | OpenTelemetry integration tracing requests across UI → API → LDAP/Postgres/Redis |
| **Log Aggregation** | `[t2]` | Structured log shipping to Loki/Elasticsearch with search UI |

## 14. Deployment & Operations

| Feature | Priority | Description |
|---------|----------|-------------|
| **Helm Chart / Kubernetes** | `[t2]` | Official Helm chart for K3s/K8s deployment with HPA, PVC, ingress, service mesh |
| **Ansible Playbooks** | `[t2]` | Automated provisioning of the full stack on bare metal / VMs |
| **One-Click Cloud Deploy** | `[t2]` | Deploy to Hetzner/DigitalOcean/AWS with a single command (Terraform + cloud-init) |
| **Database Migration CLI** | `[t2]` | Alembic-based migration runner with rollback, dry-run, status commands |
| **Auto-Upgrade Pipeline** | `[t2]` | Zero-downtime rolling updates with health-check gating and automatic rollback |
| **Environment Variable Reference** | `[t2]` | Comprehensive docs for all ENV config options (auto-generated from code) |
| **Config Validation on Startup** | `[t2]` | Validate all configuration on boot and emit actionable error messages |

## 15. Niche & Differentiator

| Feature | Priority | Description |
|---------|----------|-------------|
| **Anonymous File Drop** | `[t4]` | Receive files from external users via upload link (like Dropbox File Request) |
| **Newsletter Engine** | `[t4]` | Create, send, and track HTML newsletters to mailing lists with unsubscribe management |
| **Digital Document Signing** | `[t4]` | Simple crypto-signing of documents (PDF) using user's PGP key |
| **Email-based Task Creation** | `[t4]` | Forward email → create task, CC → assign, set due date via email header |
| **Appointments via Email** | `[t5]` | "Book a meeting with me" parsed from email (natural language date/time extraction) |
| **Read-Only Public Profile** | `[t4]` | Public page with contact info, free/busy, and booking link (like About.me for groupware) |
| **Separate Encrypted Inbox** | `[t4]` | Alternative inbox showing only PGP-encrypted messages |
| **Usage Insights for Users** | `[t4]` | Personal dashboard: emails sent/received, meeting hours, storage breakdown |
| **Holiday Calendar Feeds** | `[t4]` | Auto-configure country/region-specific holiday calendars per user locale |
| **Email Time Machine** | `[t4]` | Browse snapshot of mailbox as it existed on a given date (soft-delete recovery) |

---

## 16. Communication Beyond Email

| Feature | Priority | Description |
|---------|----------|-------------|
| **Built-in Chat (Matrix)** | `[t7]` | Embedded Matrix client for team chat — rooms, DMs, file sharing, threads. Bridges mail ↔ chat (notify, reply by chat) |
| **VoIP / SIP Integration** | `[t7]` | Click-to-call from contacts, SIP URI dialing, call history, voicemail-to-email |
| **Voice Notes / Audio Messages** | `[t4]` | Record and attach audio messages in compose or calendar events |
| **Video Mail** | `[t7]` | Record short video messages and embed/send as HTML email with thumbnail |
| **Jitsi / Meet Integration** | `[t4]` | One-click video conference creation from calendar events, auto-include join link |
| **Instant Meeting** | `[t4]` | "Meet now" button that creates ad-hoc video room + sends calendar invite to participants |
| **Email-to-Chat Bridge** | `[t7]` | Selected mailing lists or senders auto-forwarded to chat channel |

## 17. Federation & Decentralization

| Feature | Priority | Description |
|---------|----------|-------------|
| **ActivityPub / Fediverse** | `[t7]` | Publish calendar events, contacts, and public posts via ActivityPub. Follow other instances, cross-domain free/busy |
| **Federated Calendar Sharing** | `[t7]` | Share calendar with users on other groupware instances (CalDAV federation) |
| **Cross-Domain Free/Busy** | `[t7]` | Look up free/busy across organizational boundaries via delegated discovery |
| **Federated Contacts** | `[t7]` | Global address book lookup across trusted partner organizations (LDAP federation or CardDAV mesh) |
| **OpenID Federation** | `[t7]` | Trust chain-based cross-org authentication without per-org account provisioning |
| **Remote Mailbox Access** | `[t7]` | Delegate access to mailboxes across different servers/domains with proper ACL propagation |

## 18. Education & Academia

| Feature | Priority | Description |
|---------|----------|-------------|
| **LMS Integration** | `[t6]` | Sync courses, assignments, and grades with Moodle / ILIAS / Canvas. Calendar feed per course |
| **Student Group Management** | `[t6]` | Auto-provision groups from SIS/LDAP, term-based expiry, mailing lists per cohort |
| **Research Collaboration Spaces** | `[t6]` | Shared calendars + contacts + file storage for research projects with controlled access |
| **Academic Calendar Templates** | `[t6]` | Semester schedules, lecture periods, exam weeks, holidays pre-configured per institution |
| **Bulk Email for Faculty** | `[t6]` | Send announcements to course participants, guardian contacts with read tracking |
| **Grade Distribution via Email** | `[t6]` | Secure individualized grade/feedback delivery via encrypted email |
| **Thesis / Project Submission** | `[t6]` | Upload portal with deadline enforcement, plagiarism check integration, reviewer assignment |
| **Digital Signatures for Academic Documents** | `[t6]` | Sign grade reports, certificates, letters of recommendation with institutional key |
| **Room & Equipment Booking (Academic)** | `[t6]` | Extended resource booking with recurring lecture slots, setup time, AV equipment bundles |

## 19. Healthcare & Life Sciences

| Feature | Priority | Description |
|---------|----------|-------------|
| **HIPAA Compliance Mode** | `[t6]` | Enhanced audit logging, minimum necessary access, automatic encryption, BA agreement templates |
| **Clinical Calendar Integration** | `[t6]` | Appointment types, patient time slots, cancellation policies, reminder workflows (SMS/email) |
| **Secure Provider-to-Provider Messaging** | `[t6]` | Direct secure messaging between healthcare providers (XDM/XDR, DirectTrust compatible) |
| **Patient Portal Messaging** | `[t6]` | Secure email threads with patients, consent management, auto-bcc to EHR |
| **Lab Results Delivery** | `[t6]` | Secure delivery of lab results with delivery confirmation, read receipt, and printable PDF |
| **On-Call Scheduling** | `[t6]` | Physician on-call rotation calendar, escalation rules, schedule handoff notifications |
| **Clinical Trial Calendar** | `[t6]` | Protocol-driven visit scheduling, participant tracking, milestone alerts |
| **PHI Auto-Detection** | `[t6]` | Scan outbound emails for PHI/PII, warn or block based on policy (enhanced DLP) |
| **BAA-ready Audit Export** | `[t6]` | Export auditable access logs in HIPAA-compliant format with user, timestamp, action, resource |

## 20. Government & Public Sector

| Feature | Priority | Description |
|---------|----------|-------------|
| **eIDAS / Qualified Signatures** | `[t6]` | Integration with EU eIDAS-compliant signature services for legally binding email signatures |
| **FOIA / Freedom of Information Workflow** | `[t6]` | Auto-identify and flag FOIA-relevant correspondence, retention, redaction workflow |
| **Classified Email Handling** | `[t6]` | Visual classification markers (VS-NfD, Confidential, Secret), automatic footer injection |
| **Official Notification Delivery** | `[t6]` | Tracked delivery with legal proof of receipt, signed acknowledgment receipts |
| **Citizen Inbox** | `[t6]` | Public-facing contact form → structured ticket in groupware → response via email with tracking |
| **Council / Committee Calendar** | `[t6]` | Public meeting calendar with agenda publishing, minutes attachment, public comment periods |
| **Document Workflow (Government)** | `[t6]` | Structured document routing: draft → review → countersign → final → archive |
| **Transparency Portal Integration** | `[t6]` | Auto-publish non-sensitive correspondence metadata for public transparency |

## 21. Non-Profit & Civil Society

| Feature | Priority | Description |
|---------|----------|-------------|
| **Donor Communication Management** | `[t6]` | Segment donors, send thank-you emails, track engagement, recurring donation reminders |
| **Volunteer Scheduling** | `[t6]` | Shift-based calendar, availability collection, reminder notifications, swap requests |
| **Grant Management Calendar** | `[t6]` | Track application deadlines, reporting dates, funding milestones per grant |
| **Campaign Email Engine** | `[t6]` | Design, send, and track email campaigns with open/click tracking, unsubscribe management |
| **Member Directory** | `[t6]` | Self-updating member directory with privacy controls (show/hide fields per member) |
| **Newsletter Management** | `[t6]` | Drag-and-drop newsletter builder, subscriber list management, delivery analytics |
| **Petition / Signature Collection** | `[t6]` | Email-based petition tool with verified signature collection and export |

## 22. Developer & Power User

| Feature | Priority | Description |
|---------|----------|-------------|
| **API Playground (Swagger UI)** | `[t0]` | Interactive OpenAPI documentation with try-it-out, auth token generation, rate limit visibility |
| **CLI Tool** | `[t2]` | Python CLI for mailbox management, user provisioning, batch operations, automation scripting |
| **Webhook Debugger** | `[t3]` | Inspect webhook deliveries, retry failed ones, view payloads, replay events |
| **Sandbox / Staging Mode** | `[t2]` | Isolated test environment with synthetic data, replay production traffic for testing |
| **Feature Flags System** | `[t2]` | Toggle features per-user or per-domain, gradual rollout, A/B testing framework |
| **Schema Browser** | `[t2]` | Visual database schema explorer, relationship viewer, query builder |
| **Mailbox Debug Panel** | `[t2]` | Inspect raw email source, Sieve processing trace, IMAP session log, delivery chain |
| **Scriptable Rules Engine** | `[t7]` | Sandboxed JavaScript/Python filter scripts — programmable mail processing beyond Sieve |
| **Custom Dashboard Widgets** | `[t4]` | Embeddable widgets: RSS, weather, system status, calendar, quick compose — user-configurable layout |
| **OpenCloud / Nextcloud File Picker Widget** | `[t3]` | Dashboard widget and compose sidebar showing recent/pinned OpenCloud and Nextcloud files for quick attachment — served via nubusintercom bridge |
| **Email as API** | `[t4]` | Trigger actions via structured email: email-to-ticket, email-to-webhook, email-to-file |
| **Disposable Email Aliases** | `[t4]` | Per-service aliases (like SimpleLogin/Addy.io), auto-generated, expiring, reply-anonymized |
| **WebSocket API** | `[t3]` | Real-time event stream for third-party integrations — new mail, calendar changes, contact updates |
| **WebDAV Full Access** | `[t2]` | Full WebDAV filesystem access to attachments, calendar exports, contact vCards |

## 23. Accessibility & Inclusion

| Feature | Priority | Description |
|---------|----------|-------------|
| **WCAG 2.2 AA/AAA Compliance** | `[t2]` | Full accessibility audit and remediation — screen reader, keyboard navigation, focus management |
| **Dyslexia-Friendly Mode** | `[t4]` | Specialized font (OpenDyslexic), increased letter spacing, colored overlays, reduced contrast |
| **Simplified UI Mode** | `[t4]` | Reduced feature set, larger buttons, high contrast, minimal navigation — for seniors or low-vision |
| **Screen Reader Optimization** | `[t2]` | ARIA labels, live regions for dynamic content, announcement of unread count, calendar event changes |
| **Voice Navigation** | `[t7]` | Voice commands for common actions (compose, send, search, archive) via Web Speech API |
| **Keyboard-Only Workflow** | `[t2]` | Full task completion without mouse: compose, calendar, admin, settings — all keyboard accessible |
| **Language Simplification** | `[t4]` | Toggle simplified language mode (plain English, reduced jargon) for cognitively accessible UI |
| **Focus Mode / Distraction-Free** | `[t1]` | Minimal interface for ADHD/cognitive load — single task, no sidebar, quiet colors |
| **Color-Blind Safe Themes** | `[t4]` | All status indicators use shape + text, not just color. CVD-safe color palettes |
| **Assistive Technology API** | `[t4]` | Expose mailbox/calendar state for assistive tech via structured JSON endpoint |

## 24. Sustainability & Green IT

| Feature | Priority | Description |
|---------|----------|-------------|
| **Energy Usage Dashboard** | `[t7]` | Estimate and display power consumption of the groupware stack (CPU, storage, network) |
| **Cold Data Auto-Archiving** | `[t2]` | Move emails older than N years to low-power object storage (S3 Glacier, Backblaze B2) |
| **Storage Efficiency Reports** | `[t2]` | Deduplication savings, attachment storage analysis, orphaned data cleanup, compressible content |
| **Carbon Footprint Estimation** | `[t7]` | Per-mailbox or per-organization carbon impact estimate (storage GB × emission factor) |
| **Email Traffic Optimization** | `[t2]` | Compress large attachments, strip redundant headers, batch delivery for low-priority mail |
| **Green Hosting Recommendations** | `[t7]` | Dashboard showing renewable energy hosting options, offset suggestions |
| **Auto-Suspend Inactive Mailboxes** | `[t2]` | Detect dormant accounts (no login for 90d), archive data, release resources, notify admin |
| **Data Lifecycle Automation** | `[t2]` | Tiered storage policies: hot (SSD) → warm (HDD) → cold (object) → delete — per retention class |

## 25. Content & Publishing

| Feature | Priority | Description |
|---------|----------|-------------|
| **Built-in Wiki / Knowledge Base** | `[t7]` | Team wiki with Markdown, version history, internal linking, read/write permissions |
| **Blog / Newsletter Publishing Engine** | `[t4]` | Write, schedule, publish blog posts and newsletters. Auto-convert to email campaign |
| **Form Builder** | `[t4]` | Drag-and-drop form creator, responses collected as structured data, email notification on submit |
| **Poll Creator** | `[t4]` | Create quick polls, embed in email, collect votes, show results |
| **Document Templates** | `[t4]` | Save email, calendar, document templates with variables for reuse |
| **Meeting Minutes / Notes** | `[t4]` | Collaborative note-taking during calendar events, auto-attach to event, share with attendees |
| **Signature Management (Advanced)** | `[t1]` | Multiple signatures per identity, HTML templates, dynamic fields, A/B testing, legal disclaimers per domain |
| **Email Branding** | `[t2]` | Branded email footers, consistent header images, social links, unsubscribe branding |

## 26. Data Portability & Interoperability

| Feature | Priority | Description |
|---------|----------|-------------|
| **Google Takeout Import** | `[t2]` | Import Mail, Calendar, Contacts from Google Takeout MBOX/iCal/vCard |
| **M365 Export Import** | `[t2]` | PST import/export, M365 Calendar API sync-once, Contact migration |
| **IMAP Sync Tool** | `[t2]` | Incremental IMAP migration from any provider with progress tracking and conflict resolution |
| **Open Standards Compliance Report** | `[t2]` | Self-assessment against RFC compliance (IMAP, SMTP, CalDAV, CardDAV, Sieve, JMAP) |
| **Full Account Takeout** | `[t2]` | One-click export of all user data (mail, calendar, contacts, settings) as standard formats |
| **Cross-Server Mailbox Move** | `[t7]` | Zero-downtime mailbox relocation between servers while preserving folder subscriptions, filters, flags |
| **Schema Export / Import** | `[t2]` | Full database schema dump with migration scripts for version upgrades |

## 27. Identity & Access Management

| Feature | Priority | Description |
|---------|----------|-------------|
| **SCIM Provisioning** | `[t3]` | System for Cross-domain Identity Management — auto-provision/deprovision users from Azure AD, Okta, Keycloak |
| **Just-In-Time Access Requests** | `[t4]` | Users request access to shared resources, managers approve, auto-grant with expiry |
| **Role-Based Access Control (RBAC)** | `[t2]` | Granular permissions per feature area (mail, calendar, contacts, admin) per role |
| **IP / Geo-Based Access Policies** | `[t2]` | Restrict access by country, IP range, VPN requirement, trusted network |
| **Approval-Based Group Membership** | `[t4]` | Users request to join groups, moderators approve, auto-removal on expiry |
| **Privileged Access Management** | `[t6]` | Admin impersonation with full audit trail, session recording, approval for sensitive actions |
| **Identity Verification Levels** | `[t6]` | LoA (Level of Assurance) per user session — determines access to sensitive resources |

## 28. File Management & Storage

| Feature | Priority | Description |
|---------|----------|-------------|
| **Built-in File Browser** | `[t7]` | Browse, upload, organize files in user/team directories (powered by MinIO) |
| **Document Versioning** | `[t7]` | Automatic version history for uploaded documents, diff preview, restore |
| **OCR for Scanned Documents** | `[t5]` | Auto-OCR on uploaded PDF/images, make text searchable, attach text layer |
| **Image Gallery / Lightbox** | `[t7]` | Photo album view for image attachments and uploaded media, slideshow mode |
| **Media Transcoding** | `[t7]` | Auto-transcode video/audio uploads to web-playable formats, thumbnail generation |
| **Full-Text Document Indexing** | `[t2]` | Index PDF, Office documents, text files for search (Tika / textract pipeline) |
| **Secure File Sharing** | `[t4]` | Share files via link with password, expiration, download limit, audit log |
| **Favorites / Starred Files** | `[t4]` | Quick-access personal file favorites, recent files, shared-with-me view |
| **File Request / Upload Portal** | `[t4]` | External-facing upload page for receiving files (like Dropbox File Request) |
| **Collaborative Document Editing** | `[t7]` | Real-time co-authoring via Collabora Online / OnlyOffice Documents integrated in file browser |

## 29. Gamification & Engagement

| Feature | Priority | Description |
|---------|----------|-------------|
| **Inbox Zero Streaks** | `[t4]` | Track consecutive days of zero unread, badge rewards, weekly summaries |
| **Email Response Time Stats** | `[t4]` | Personal analytics: median response time, busiest hours, top correspondents |
| **Team Productivity Leaderboards** | `[t4]` | Opt-in team stats: quickest replies, most meetings attended, calendar responsiveness |
| **Achievement Badges** | `[t4]` | Milestones: "Sent 1000 emails", "Organized 50 events", "Inbox Zero for a month", "10 shared calendars" |
| **Weekly Productivity Report** | `[t4]` | Personal email: meetings attended, emails sent/received, tasks completed, trends over time |
| **Challenge Mode** | `[t7]` | Team challenges: "Clear inbox before Friday", "Book fewer meetings this week", adoption nudges |
| **Onboarding Progress** | `[t4]` | New user checklist: set up signature, configure filters, book first meeting, share a calendar |
| **Focus Time Tracking** | `[t4]` | Track and reward protected focus time blocks, meeting-free days |

## 30. Disaster Recovery & Business Continuity

| Feature | Priority | Description |
|---------|----------|-------------|
| **Geo-Redundancy** | `[t7]` | Active-passive or active-active deployment across data centers with automatic failover |
| **Cross-Region Mailstore Replication** | `[t7]` | Asynchronous replication of mail data to secondary region with RPO < 5 min |
| **Point-in-Time Recovery** | `[t2]` | Restore mailbox/calendar to any point within retention window (not just latest backup) |
| **Automated DR Drill** | `[t7]` | Scheduled failover exercises, recovery time measurement, non-compliance alerts |
| **Mail Queue Protection** | `[t2]` | Persistent mail queue that survives server crash, replay on restart, duplicate detection |
| **Emergency Admin Access** | `[t2]` | Break-glass admin accounts with separate auth, full audit trail, automatic notification on use |
| **Disaster Recovery Dashboard** | `[t2]` | Real-time replication lag, last successful backup, failover status, RTO/RPO compliance |
| **Database Point-in-Time** | `[t2]` | WAL archiving enabling restore to any second within retention (PostgreSQL PITR) |
| **Configuration as Code** | `[t2]` | All configuration in version-controlled files, immutable infrastructure, gitops-style recovery |

## 31. Customization & Extensibility

| Feature | Priority | Description |
|---------|----------|-------------|
| **Custom Notification Channels** | `[t4]` | Pluggable notification backends: Telegram, WhatsApp (Biz API), Signal, Slack, Discord, WebSocket |
| **Dashboard Widget SDK** | `[t7]` | Build custom dashboard widgets with simple HTML/JS, register via plugin API |
| **Custom Actions / Quick Actions** | `[t4]` | User-defined actions: "Forward + label + mark done" as one click |
| **Workflow Builder (Visual)** | `[t4]` | Low-code automation: "If email from X and subject contains Y → forward to Z, create event, notify" |
| **UI Themes Marketplace** | `[t4]` | Community-contributed themes, install one-click, per-user theme selection |
| **Custom Fields** | `[t4]` | Add custom fields to contacts, events, tasks — schema-per-domain or per-user |
| **Report Builder** | `[t4]` | Drag-and-drop report designer for mailbox usage, calendar analytics, contact statistics |
| **Integration Marketplace** | `[t7]` | Curated directory of third-party integrations (webhooks, bots, OAuth apps) with one-click install |

## 32. Emerging Tech & Future-Proofing

| Feature | Priority | Description |
|---------|----------|-------------|
| **Post-Quantum Cryptography** | `[t7]` | Hybrid PQ/Traditional email encryption (X25519Kyber768), PQ-certificate support for S/MIME |
| **Decentralized Identity (DID)** | `[t7]` | W3C DID-based identity for email, verifiable credentials for organizational roles |
| **Blockchain Timestamping** | `[t7]` | Anchor email hashes to blockchain for non-repudiation and legal proof |
| **AR/VR Calendar** | `[t7]` | Spatial calendar visualization in WebXR — walk through your week, grab and move events |
| **Brain-Computer Interface** | `[t7]` | Experimental: compose and send "thought" email via EEG headset (Web Bluetooth + mental classifier) |
| **DAO Governance Integration** | `[t7]` | Token-gated access to shared resources, proposal voting via email, treasury notifications |
| **Edge Deployment** | `[t7]` | Run groupware on K3s at edge locations, offline-capable, sync when connected |
| **Wearable Notifications** | `[t7]` | Smartwatch-optimized notification summaries, quick actions (archive, reply template) from wrist |

---

## How Features Are Selected

1. **User demand** — feedback from SOGo community, mailing list, GitHub issues
2. **Architectural fit** — extends existing patterns (shared ACL engine, Redis caching, Flask blueprints)
3. **Effort vs. impact** — features that deliver high user value with reasonable complexity
4. **Differentiation** — features that distinguish this fork from upstream SOGo and proprietary groupware
5. **AI-native** — leverage local LLMs and ML to add intelligence that competitors don't have

## Priority Definitions

| Label | Meaning |
|-------|---------|
| `[t0]` | **Tier 0 — Foundation.** Highest impact, unlocks others. Implement next |
| `[t1]` | **Tier 1 — Core Experience.** Visible daily to all users |
| `[t2]` | **Tier 2 — Admin & Scale.** Operational excellence, compliance |
| `[t3]` | **Tier 3 — Ecosystem.** Platform integration play |
| `[t4]` | **Tier 4 — Team & Productivity.** Collaboration enhancements |
| `[t5]` | **Tier 5 — AI & Intelligence.** ML-powered features |
| `[t6]` | **Tier 6 — Vertical Markets.** Sector-specific (healthcare, edu, gov) |
| `[t7]` | **Tier 7 — Advanced / Long-Term.** High effort or speculative |

---

## Contributing

See `CONTRIBUTING.md` for development workflow. Feature proposals should be opened as GitHub Issues with the `enhancement` label.
