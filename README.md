# WooCommerce Analytics Dashboard

Standalone analytics & marketing dashboard voor WooCommerce. Verbindt via de REST API (read-only) en biedt:

- **Product performance & forecasting** — nieuwe & stijgende producten, dalende producten, maandforecast
- **Klant segmentatie** — auto-detectie van logo/tekst kopers, herinnerings-e-mails na 3 maanden
- **Marge dashboard** — omzet, inkoopkosten, verzendkosten → bruto marge

## Vereisten

- Node.js 20+ op de server
- PM2 (`npm install -g pm2`)
- WooCommerce Consumer Key & Secret
- Mailtrap account (voor e-mails)

---

## Installatie op DirectAdmin (eigen server)

### 1. SSH in op de server en ga naar de projectmap

```bash
cd /home/gebruiker/domains/jouwdomein.nl/dashboard
# of waar je het project hebt gecloned
```

### 2. Maak het `.env` bestand aan

```bash
cp .env.example .env
nano .env        # of vi .env
```

Vul in:

```env
DATABASE_URL="file:./data/dashboard.db"
WOOCOMMERCE_URL="https://jouwwinkel.nl"
WOOCOMMERCE_CONSUMER_KEY="ck_xxxx"
WOOCOMMERCE_CONSUMER_SECRET="cs_xxxx"
MAILTRAP_API_TOKEN="jouw_mailtrap_token"
MAILTRAP_FROM_EMAIL="noreply@jouwwinkel.nl"
MAILTRAP_FROM_NAME="Klompjes"
CRON_SECRET="verzin_hier_een_lang_wachtwoord"
NEW_PRODUCT_WINDOW_DAYS=60
REMINDER_MONTHS=3
```

> ⚠️ Het `.env` bestand staat in `.gitignore` — het wordt nooit naar GitHub gepusht.

### 3. Eerste keer opzetten

```bash
npm ci --omit=dev
npx prisma generate
mkdir -p data
npx prisma db push
npm run build
```

### 4. Starten met PM2

```bash
pm2 start ecosystem.config.js
pm2 save          # onthoudt de app na reboot
pm2 startup       # laat PM2 automatisch starten na serverreboot
                  # (kopieer en plak het commando dat het toont)
```

Controleer of het draait:
```bash
pm2 status
pm2 logs klompjes-dashboard
```

### 5. Koppel een (sub)domein in DirectAdmin

- DirectAdmin → Domeinen → Subdomein toevoegen, b.v. `dashboard.jouwwinkel.nl`
- Stel een reverse proxy in naar `http://127.0.0.1:3000`
- In Apache/LiteSpeed via DirectAdmin → Custom HTTPD config:

```apache
ProxyPass / http://127.0.0.1:3000/
ProxyPassReverse / http://127.0.0.1:3000/
```

Of als je Nginx gebruikt:
```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### 6. Na elke GitHub push — automatisch deployen

Voeg dit toe aan je git `post-receive` hook op de server
(`/home/gebruiker/.git/hooks/post-receive` of waar jouw bare repo staat):

```bash
#!/bin/bash
cd /pad/naar/jouw/projectmap
git pull origin main
bash deploy.sh
```

Of roep `deploy.sh` handmatig aan na een pull:
```bash
git pull && bash deploy.sh
```

`deploy.sh` doet automatisch: `npm ci` → `prisma db push` → `npm run build` → `pm2 reload`.

---

## Geplande taken (dagelijkse sync)

### Optie A — DirectAdmin crontab (aanbevolen)

Ga in DirectAdmin naar **Cron Jobs** en voeg toe (dagelijks 02:00):

```
0 2 * * *   curl -fsS -X POST https://dashboard.jouwwinkel.nl/api/cron/sync-products -H "Authorization: Bearer JOUW_CRON_SECRET"
30 2 * * *  curl -fsS -X POST https://dashboard.jouwwinkel.nl/api/cron/sync-orders -H "Authorization: Bearer JOUW_CRON_SECRET"
0 9 * * *   curl -fsS -X POST https://dashboard.jouwwinkel.nl/api/cron/process-reminders -H "Authorization: Bearer JOUW_CRON_SECRET"
```

Vervang `JOUW_CRON_SECRET` met de waarde uit je `.env`.

### Optie B — Worker process via PM2

Voeg toe aan `ecosystem.config.js` (of draai apart):

```bash
npm run worker
# of: pm2 start worker.ts --interpreter tsx
```

---

## Omgevingsvariabelen

| Variabele | Verplicht | Beschrijving |
|---|---|---|
| `DATABASE_URL` | Ja | SQLite pad, b.v. `file:./data/dashboard.db` |
| `WOOCOMMERCE_URL` | Ja | Webshop URL, b.v. `https://jouwwinkel.nl` |
| `WOOCOMMERCE_CONSUMER_KEY` | Ja | WooCommerce → Instellingen → Geavanceerd → REST API |
| `WOOCOMMERCE_CONSUMER_SECRET` | Ja | Zie boven |
| `MAILTRAP_API_TOKEN` | Ja | Mailtrap Sending API token |
| `MAILTRAP_FROM_EMAIL` | Ja | Afzender e-mailadres |
| `MAILTRAP_FROM_NAME` | Nee | Afzendernaam |
| `CRON_SECRET` | Ja | Willekeurig lang wachtwoord voor cron endpoints |
| `NEW_PRODUCT_WINDOW_DAYS` | Nee | Dagen dat een product "nieuw" is (standaard: 60) |
| `REMINDER_MONTHS` | Nee | Maanden wachten voor herinnering (standaard: 3) |

---

## Open punten

- **Verzendkosten**: toont wat de klant betaalde (`shipping_total`), niet de werkelijke verzendfactuur.
- **Google Ads**: wordt later toegevoegd zodra de API-toegang geregeld is.

## Tech stack

- **Next.js 15** — dashboard UI + API routes
- **Prisma + SQLite** — lokale database
- **PM2** — process management op de server
- **Recharts** — grafieken
- **Mailtrap** — transactionele e-mail
