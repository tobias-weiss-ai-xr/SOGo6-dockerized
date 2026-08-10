# DMARC/DKIM/SPF Setup via Stalwart Web Admin UI

> **Betrifft:** SOGo6-dockerized (Stalwart v0.16.x)  
> **Web-Admin:** http://localhost:8080/admin/  
> **Credentials:** `admin` / `eval_admin_2026`

## Schritt 1: Admin UI öffnen

```bash
open http://localhost:8080/admin/
# Oder: curl aus dem Container
docker exec -it sogo6-stalwart stalwart -o
```

Login mit `admin` / `eval_admin_2026`.

## Schritt 2: DKIM-Key anlegen

1. **Menü:** `Domain` → `example.org`
2. **Tab:** `Keys`
3. **Button:** `Generate Key`
   - Selector: `s1`
   - Algorithmus: `RSA 2048`
   - **Generate**
4. **Public Key kopieren** (wird für DNS benötigt)
5. **DNS-Eintrag setzen:**
   ```
   s1._domainkey.example.org.  TXT  "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ..."
   ```

## Schritt 3: DMARC-Reporting aktivieren

1. **Menü:** `Settings` → `SMTP` → `Receive`
2. **DMARC:**
   - `Report`: ✅ Enable
   - `Report RUA`: `mailto:dmarc@example.org`
   - `Report Interval`: `86400`
   - `Report Failure Options (FO)`: `1` (DKIM OR SPF fail)
3. **SPF:**
   - `Verify`: ✅ Enable (Phase 1: reject = false)
4. **DKIM:**
   - `Verify`: ✅ Enable (Phase 1: reject = false)

## Schritt 4: Ausgehende DKIM-Signatur aktivieren

1. **Menü:** `Settings` → `SMTP` → `Send`
2. **DKIM Signing:**
   - `Sign`: ✅ Enable
   - `Key`: `s1` (aus Schritt 2)
   - `Domain`: `example.org`
   - `Canonicalization`: `relaxed/simple`
   - `Header List`: `From, Reply-To, Subject, Date, To, Cc, Message-ID`

## Schritt 5: ARC aktivieren

1. **Menü:** `Settings` → `SMTP` → `ARC`
2. **ARC:**
   - `Add seal`: ✅ Enable
   - `Add timestamp`: ✅ Enable
   - `Verify`: ✅ Enable

## Schritt 6: DNS-Einträge setzen (lokal)

```bash
# DMARC
docker exec sogo6-stalwart sh -c 'echo "_dmarc.example.org.  TXT  \"v=DMARC1; p=none; rua=mailto:dmarc@example.org; fo=1; ri=3600\"" >> /etc/dnsmasq.conf'
# SPF  
docker exec sogo6-stalwart sh -c 'echo "example.org.  TXT  \"v=spf1 mx ip4:172.20.0.0/16 ~all\"" >> /etc/dnsmasq.conf'
```

## Schritt 7: Testen

```bash
# Im Container: Testmail senden
docker exec sogo6-stalwart sh -c \
  'echo "DMARC Test" | mail -s "DMARC Test" test@example.org'

# Logs prüfen
docker logs sogo6-stalwart 2>&1 | grep -E "dmarc|dkim|spf"

# Externen Testdienst nutzen
# https://www.mail-tester.com / https://dmarcly.com/tools/dmarc-check
```

## Phasenplan

| Phase | Einstellung | Dauer | 
|:------|:------------|:------|
| **1** Monitoring | `reject-* = false`, `verify = true`, `report = true` | 1 Woche |
| **2** Quarantine | `reject-dmarc = true` | 2 Wochen |
| **3** Reject | `reject-spf = true`, `reject-dkim = true`, `reject-dmarc = true` | Dauerhaft |
