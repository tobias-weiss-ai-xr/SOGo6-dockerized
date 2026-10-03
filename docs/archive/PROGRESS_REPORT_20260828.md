# SOGo6-dockerized: Full CI Green & Call for Community Testing

**Date:** 2026-08-28
**Status:** ✅ All workflows green, no open PRs, branches cleaned

## 🎉 Milestone Achieved

The SOGo6-dockerized project has reached a significant milestone:

- **CI fully green** — All 7 jobs of the Test workflow pass consistently (Playwright E2E, UI Build & Test, Stack build + backend tests, Lint, Security scan, OWASP ZAP, Load/Performance).
- **No open PRs** — All pending changes have been merged or integrated.
- **Branches cleaned** — Stale superseded branches have been retired; only `main` remains in all repos.
- **CRA Compliance Remediation** — Marked as done (phases 1–4 complete, CI verification passed).

## 📦 What’s Delivered

### Features (latest)
- **Calendar ICS export dialog** — Job-based export with download (replaces placeholder).
- **Public calendar subscription management** — Enable/revoke share tokens, backend-generated public URLs.
- **RE:/FWD: subject prefixing** — Idempotent reply prefixing, forward strip+re-add.
- **PGP sign/encrypt compose toggles** — Already present in main (security-options.tsx + slice reducers).

### Test Coverage
- **Backend unit:** 2387 passed, 1 skipped
- **Integration (live stack):** 34 passed, 8 skipped (environmental skips: SMTP delivery)
- **Shell suite:** All 157 passed
- **UI Jest:** 574 suites / 6000 tests — 5994 passed, 6 skipped
- **Playwright E2E:** 86+ remote API specs green
- **Security & Lint:** Trivy scan, OWASP ZAP baseline, shellcheck — all pass

### CI Health
- **Test workflow:** 7 jobs, all green on latest commit (`df41086`)
- **OpenSpec Validation:** Passes on `.openspec/**` changes
- **Six Sigma Compliance:** Passes on server-source paths

## 🚀 How You Can Help

### 1. **Test & Report Issues**
- Clone the repo and run the stack locally.
- Try the new features (ICS export, public subscriptions, RE:/FWD prefixing).
- Report any bugs or usability issues via GitHub Issues.

### 2. **Contribute Code**
- Pick up an open issue or propose a new feature.
- Follow the project’s contribution guidelines.
- Submit PRs for review.

### 3. **Improve Documentation**
- Help update the README, docs, and guides.
- Add examples or tutorials for new features.

### 4. **Spread the Word**
- Share the project with others who might find it useful.
- Star the repo on GitHub to show your support.

## 📖 Getting Started

1. **Clone the repo:**
   ```bash
   git clone https://github.com/tobias-weiss-ai-xr/SOGo6-dockerized.git
   cd SOGo6-dockerized
   ```

2. **Set up the stack:**
   ```bash
   docker compose --profile db-mariadb --profile auth-ldap --profile mail-stalwart up -d
   bash sogo6/scripts/init-sogo6.sh
   ```

3. **Run tests:**
   ```bash
   bash tests/run-all-tests.sh
   ```

4. **Explore the UI:**
   - Open `http://localhost:3000` in your browser.
   - Log in with the default credentials (admin/admin).

## 🔗 Links

- **GitHub:** [https://github.com/tobias-weiss-ai-xr/SOGo6-dockerized](https://github.com/tobias-weiss-ai-xr/SOGo6-dockerized)
- **Documentation:** [https://github.com/tobias-weiss-ai-xr/SOGo6-dockerized/tree/main/docs](https://github.com/tobias-weiss-ai-xr/SOGo6-dockerized/tree/main/docs)
- **Issues:** [https://github.com/tobias-weiss-ai-xr/SOGo6-dockerized/issues](https://github.com/tobias-weiss-ai-xr/SOGo6-dockerized/issues)

## 🙏 Thank You

Thank you to everyone who has contributed to the project so far. Your feedback and contributions are invaluable in making SOGo6-dockerized a robust and reliable solution.

Let’s build the future of open-source collaboration together! 🚀
