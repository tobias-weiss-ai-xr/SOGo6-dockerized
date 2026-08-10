# DMARC-TODO: SOGo6-dockerized (Dev‑Stack)

> **Kontext:** Docker Compose‑Entwicklungsumgebung für SOGo 6 (Next.js + Flask)  
> mit Stalwart Mail Server, OpenLDAP, MariaDB/MariaDB, Redis, Nginx.  
> Stalwart ist der alleinige MTA (built‑in SMTP). Ideal für DMARC‑Tests.

---

## Phase 0: Bestandsaufnahme

- [ ] **0.1** Aktuelle Stalwart‑Konfiguration sichern
  ```bash
  docker compose exec sogo6-stalwart stalwart-cli config show > /tmp/stalwart-config-backup.toml
  ```

- [ ] **0.2** Standarddomain ermitteln
  ```bash
  docker compose exec sogo6-stalwart stalwart-cli domain list
  # Default: example.org (aus LDAP_DOMAIN)
  ```

- [ ] **0.3** Vorhandene DKIM‑Keys prüfen
  ```bash
  docker compose exec sogo6-stalwart stalwart-cli domain key list example.org
  ```

- [ ] **0.4** Aktuelle Stalwart‑Version und DMARC‑Fähigkeit prüfen
  ```bash
  docker compose exec sogo6-stalwart stalwart --version
  # Stalwart v0.16+ hat vollständige DMARC-/DKIM-/ARC-Unterstützung
  ```

---

## Phase 1: Entwicklungsumgebung – DNS vorbereiten

> Im Dev‑Stack haben Sie keine öffentliche Domain.  
> Optionen:
> - **A:** Echte Domain mit öffentlichem DNS (z. B. `dmarc-test.example.org`)
> - **B:** Lokalen DNS‑Resolver mit `dnsmasq` / `/etc/hosts` (nur für lokale Tests)
> - **C:** `split‑DNS` – nur für ausgehende Tests (an SMTP‑Relay)

- [ ] **1.1** Entscheidung treffen → **Empfehlung: Option C** für schnelle Dev‑Tests

- [ ] **1.2** DNS‑Einträge in `docker-compose.dev.yaml` vorbereiten (oder extern)
  ```yaml
  # Beispiel für split-DNS mit dnsmasq-Sidecar (optional)
  dnsmasq:
    image: jpillora/dnsmasq:latest
    container_name: sogo6-dns
    environment:
      HTTP_USER: admin
      HTTP_PASS: admin
    volumes:
      - ./dnsmasq.conf:/etc/dnsmasq.conf:ro
    ports:
      - "53:53/udp"
      - "5380:8080"
  ```
  ```conf
  # dnsmasq.conf
  address=/example.org/127.0.0.1
  txt-record=_dmarc.example.org,"v=DMARC1; p=none; rua=mailto:dmarc@example.org"
  txt-record=example.org,"v=spf1 mx ~all"
  txt-record=dkim._domainkey.example.org,"v=DKIM1; k=rsa; p="
  mx-host=example.org,mail.example.org,10
  ```

- [ ] **1.3** Dnsmasq in `docker-compose.dev.yaml` als DNS für andere Container setzen
  ```yaml
  sogo6-stalwart:
    dns:
      - 172.20.0.2  # IP des dnsmasq-Containers
  ```

---

## Phase 2: SPF im Dev‑Stack

- [ ] **2.1** SPF‑Record für die Dev‑Domain setzen
  ```
  example.org.  TXT  "v=spf1 mx a:mail.example.org ip4:172.20.0.0/16 ~all"
  ```
  (Das Subnetz des Docker‑Netzwerks)

- [ ] **2.2** SPF‑Prüfung in Stalwart aktivieren
  ```toml
  [session.smtp.rcpt]
  reject-spf = true
  ```

- [ ] **2.3** SPF‑Prüfung testen
  ```bash
  # Mail von authorisierter IP senden → soll akzeptiert werden
  docker compose exec sogo6-stalwart sh -c \
    'echo "SPF Test" | mail -s "SPF Pass" user@example.org'
  
  # Mail von nicht-authorisierter IP simulieren → soll rejected werden
  # (Schwierig im dev container → stattdessen Logs prüfen)
  docker compose logs sogo6-stalwart | grep spf
  ```

---

## Phase 3: DKIM im Dev‑Stack

- [ ] **3.1** DKIM‑Key mit Stalwart‑CLI generieren
  ```bash
  docker compose exec sogo6-stalwart stalwart-cli domain key generate example.org s1 2048
  ```

- [ ] **3.2** Public‑Key anzeigen und in DNS eintragen
  ```bash
  docker compose exec sogo6-stalwart stalwart-cli domain key get example.org s1
  ```
  ```
  s1._domainkey.example.org.  TXT  "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSI..."
  ```

- [ ] **3.3** DKIM‑Signierung im Stalwart‑Config aktivieren
  ```toml
  [session.smtp.mail]
  sign = true
  key = "s1"
  domain = "example.org"
  ```

- [ ] **3.4** Signierte Testmail senden und Header prüfen
  ```bash
  docker compose exec sogo6-stalwart sh -c \
    'echo "DKIM Test" | mail -s "DKIM Signatur" external-test@example.com'
  
  # Beim Empfänger: Rohdaten-Header prüfen
  # Enthält: DKIM-Signature: v=1; a=rsa-sha256; s=s1; d=example.org; ...
  ```

- [ ] **3.5** DKIM‑Verifikation bei eingehenden Mails aktivieren
  ```toml
  [session.smtp.rcpt]
  reject-dkim = true
  ```

- [ ] **3.6** Signierte Mail von extern senden → Verifikation prüfen
  ```bash
  docker compose logs sogo6-stalwart | grep dkim
  ```

---

## Phase 4: DMARC im Dev‑Stack

- [ ] **4.1** DMARC‑Record mit `p=none` setzen
  ```
  _dmarc.example.org.  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@example.org; ruf=mailto:dmarc-ruf@example.org; fo=1; ri=3600"
  ```

- [ ] **4.2** DMARC‑Verifikation in Stalwart aktivieren
  ```toml
  [session.smtp.rcpt]
  reject-dmarc = true
  
  [report.dmarc]
  enable = true
  rua = "mailto:dmarc@example.org"
  interval = 3600
  ```

- [ ] **4.3** DMARC‑Report‑Empfang testen
  ```bash
  # Prüfen, ob Stalwart DMARC-Reports generiert
  docker compose logs sogo6-stalwart | grep dmarc
  
  # Report-Dateien im Container finden
  docker compose exec sogo6-stalwart find /opt/stalwart -name "*.xml" 2>/dev/null
  ```

- [ ] **4.4** SOGo‑Versand über Stalwart testen
  ```bash
  # Über SOGo-UI eine Mail schreiben und senden
  # Danach DMARC-Header im Log prüfen
  docker compose logs sogo6-stalwart | grep -E "dmarc|dkim|spf"
  ```

- [ ] **4.5** Zusammenspiel SOGo → Stalwart prüfen (SMTP Submission auf Port 20025)
  ```yaml
  # In sogo6-server Umgebungsvariablen (docker-compose.yaml):
  SOGO_SMTP_SERVER: sogo6-stalwart
  SOGO_SMTP_PORT: 20025
  ```
  ```toml
  # Stalwart: Submission-Port erlaubt authentifiziertes Senden
  [server.listener.submission]
  bind = ["[::]:20025"]
  protocol = "submission"
  require-authentication = true
  ```

---

## Phase 5: ARC (Authenticated Received Chain)

- [ ] **5.1** ARC‑Sealing in Stalwart aktivieren
  ```toml
  [session.smtp.arc]
  add-seal = true
  add-timestamp = true
  ```

- [ ] **5.2** ARC‑Verifikation aktivieren
  ```toml
  [session.smtp.arc]
  verify = true
  ```

- [ ] **5.3** Test: Mail über Mailingliste leiten und ARC‑Chain prüfen
  ```bash
  # Mail an Liste → Liste verteilt weiter → ARC bleibt intakt
  ```

---

## Phase 6: CI‑Integration

- [ ] **6.1** DMARC‑Smoke‑Test in die Testsuite integrieren
  ```yaml
  # tests/dmarc-test.sh
  #!/bin/bash
  # 1. Stalwart starten
  docker compose --profile mail-stalwart --profile db-mariadb --profile auth-ldap up -d
  
  # 2. DKIM-Key generieren
  docker compose exec sogo6-stalwart stalwart-cli domain key generate example.org ci-test 1024
  
  # 3. Testmail senden
  docker compose exec sogo6-stalwart sh -c \
    'echo "CI DKIM Test" | mail -s "CI Test" test@example.org'
  
  # 4. Logs prüfen
  docker compose logs sogo6-stalwart | grep -q "dkim=pass"
  echo "DKIM-Test: $?"
  ```

- [ ] **6.2** In Makefile aufnehmen
  ```makefile
  .PHONY: test-dmarc
  test-dmarc:
  	@echo "Running DMARC integration tests..."
  	@bash tests/dmarc-test.sh
  ```

---

## Phase 7: Dokumentation & Betrieb

- [ ] **7.1** DMARC‑Konfiguration in `README.md` dokumentieren
  ```markdown
  ## DMARC / DKIM / SPF
  
  Der Dev-Stack verwendet Stalwart built‑in DKIM-Signierung und DMARC-Verifikation.
  
  ### Erstsetup
  ```bash
  make dkim-setup
  ```
  
  ### DNS-Einträge (für Testdomain example.org)
  - `_dmarc.example.org` — DMARC-Policy
  - `s1._domainkey.example.org` — DKIM-Public-Key
  - `example.org` — SPF-Record
  ```
  ```

- [ ] **7.2** Makefile‑Targets für DKIM‑Setup
  ```makefile
  dkim-setup:
  	docker compose exec sogo6-stalwart stalwart-cli domain key generate example.org s1 2048
  	docker compose exec sogo6-stalwart stalwart-cli domain key get example.org s1
  
  dmarc-logs:
  	docker compose logs sogo6-stalwart | grep -E "dmarc|dkim|spf"
  ```

---

## Phase 8: Übergang zu Production‑Setup

- [ ] **8.1** DMARC‑Policy nach Testphase auf `p=quarantine` hochstufen
- [ ] **8.2** Produktions‑DKIM-Keys (4096 Bit RSA) generieren
- [ ] **8.3** DNS‑Einträge in produktive Zone übernehmen
- [ ] **8.4** `parsedmarc` für Report‑Analyse einrichten
- [ ] **8.5** Grafana‑Dashboard für DMARC‑Metriken

---

## Zusammenfassung Prioritäten

| Prio | Aufgabe | Phase | Aufwand |
|:----:|:--------|:------|:--------|
| 🔴 | DKIM‑Key generieren & aktivieren | 3 | 0.5h |
| 🔴 | DMARC `p=none` + rua | 4 | 0.5h |
| 🟡 | SPF‑Record setzen | 2 | 0.3h |
| 🟡 | Lokaler DNS (dnsmasq) für Tests | 1 | 1h |
| 🟢 | ARC aktivieren | 5 | 0.3h |
| 🟢 | CI‑Smoke‑Test | 6 | 1h |
| 🟢 | Makefile‑Targets + Doku | 7 | 1h |
| 🟢 | DMARC auf `p=quarantine` hochstufen | 8 | 0.3h |
