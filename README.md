# WooCommerce Analytics Dashboard

Standalone analytics & marketing dashboard voor WooCommerce. Verbindt via de REST API (read-only) en biedt:

- **Product performance & forecasting** — nieuwe & stijgende producten, dalende producten, maandforecast
- **Klant segmentatie** — auto-detectie van logo/tekst kopers, herinnerings-e-mails na 3 maanden
- **Marge dashboard** — omzet, inkoopkosten, verzendkosten, advertentiekosten → bruto marge

## Vereisten

- Node.js 20+
- WooCommerce Consumer Key & Secret
- Mailtrap account (voor e-mails)
- Hosting los van de WordPress site (Railway, Render, VPS, etc.)

## Installatie

```bash
# 1. Clone & installeer
npm install

# 2. Configureer omgevingsvariabelen
cp .env.example .env
# Vul .env in met jouw WooCommerce URL, API keys, etc.

# 3. Initialiseer database
npm run db:push

# 4. Start de app
npm run dev
```

## Omgevingsvariabelen

| Variabele | Verplicht | Beschrijving |
|---|---|---|
| `DATABASE_URL` | Ja | SQLite: `file:./dev.db` of Postgres URL |
| `WOOCOMMERCE_URL` | Ja | Je webshop URL, b.v. `https://jouwwinkel.nl` |
| `WOOCOMMERCE_CONSUMER_KEY` | Ja | WooCommerce → Instellingen → Geavanceerd → REST API |
| `WOOCOMMERCE_CONSUMER_SECRET` | Ja | Zie boven |
| `MAILTRAP_API_TOKEN` | Ja | Mailtrap Sending API token |
| `MAILTRAP_FROM_EMAIL` | Ja | Afzender e-mailadres |
| `MAILTRAP_FROM_NAME` | Nee | Afzendernaam |
| `CRON_SECRET` | Ja | Willekeurig wachtwoord voor cron endpoints |
| `NEW_PRODUCT_WINDOW_DAYS` | Nee | Hoeveel dagen een product "nieuw" is (standaard: 60) |
| `REMINDER_MONTHS` | Nee | Maanden wachten voor herinnering (standaard: 3) |
| `GOOGLE_ADS_*` | Nee | Google Ads API (optioneel, zie §Google Ads) |

## Geplande taken

### Optie A — Externe cron (Vercel, Railway cron, GitHub Actions)

Hit deze endpoints dagelijks met `Authorization: Bearer <CRON_SECRET>`:

```
POST /api/cron/sync-products
POST /api/cron/sync-orders
POST /api/cron/process-reminders
POST /api/cron/sync-ads          # optioneel
```

**GitHub Actions voorbeeld** (`.github/workflows/cron.yml`):
```yaml
on:
  schedule:
    - cron: '0 2 * * *'
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - run: curl -X POST ${{ secrets.DASHBOARD_URL }}/api/cron/sync-products -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
      - run: curl -X POST ${{ secrets.DASHBOARD_URL }}/api/cron/sync-orders -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
      - run: curl -X POST ${{ secrets.DASHBOARD_URL }}/api/cron/process-reminders -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### Optie B — Worker process (VPS/Railway met persistent process)

```bash
npm run worker
```

## Google Ads (optioneel)

Vereist:
1. Google Ads Developer Token aanvragen via [Google Ads API](https://developers.google.com/google-ads/api/docs/get-started/dev-token)
2. OAuth2 client ID & secret aanmaken in Google Cloud Console
3. Refresh token genereren via OAuth flow
4. `GOOGLE_ADS_CUSTOMER_ID` invullen (je Ads klant-ID zonder streepjes)

Zodra geconfigureerd, implementeer de sync in `lib/google-ads.ts` en activeer `/api/cron/sync-ads`.

## Open vragen (zie spec §11)

1. **COGS-veld**: het dashboard verwacht `_wc_cog_cost` (plugin "Cost of Goods for WooCommerce"). Controleer welk veld jouw winkel gebruikt via WooCommerce → Producten → [product] → Productdata.
2. **Definitie "nieuw product"**: standaard = eerste verkoopdatum binnen 60 dagen. Pas `NEW_PRODUCT_WINDOW_DAYS` aan of verander de logica naar `date_created` in `lib/analytics.ts:getProductPerformance`.
3. **Verzendkosten**: het dashboard toont `shipping_total` (wat de klant betaalt). Voor werkelijke kosten: voeg een handmatige kostenkolom toe of koppel de carrier API.
4. **Google Ads**: zie §Google Ads hierboven.
5. **Hosting**: standalone Node.js app — past niet op gedeelde DirectAdmin hosting. Gebruik Railway, Render, of een VPS.

## Tech stack

- **Next.js 15** — dashboard UI + API routes
- **Prisma + SQLite** — lokale database (migreer naar Postgres voor productie)
- **Recharts** — grafieken
- **Mailtrap** — transactionele e-mail
- **node-cron** — geplande taken (worker mode)
