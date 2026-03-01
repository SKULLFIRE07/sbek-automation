# Credentials & Access Needed from SBEK

## 1. Razorpay (Payments)

- **Razorpay Merchant Account** (must be activated, not just test mode)
- `RAZORPAY_KEY_ID` — API Key ID from Dashboard > Settings > API Keys
- `RAZORPAY_KEY_SECRET` — API Key Secret (shown once on generation)
- Webhook Secret for payment event verification
- Confirm enabled payment methods: UPI, Cards, Net Banking, Wallets

---

## 2. Tripo API (AI 3D Generation for Design Studio)

- **Tripo account** with API access enabled
- `TRIPO_API_KEY` — API key from Tripo dashboard
- Confirm usage tier/limits (each design generation costs credits)
- Confirm supported input formats (JPEG, PNG) and output formats (GLB, GLTF)

---

## 3. eKYC Provider (Seller Verification for Marketplace)

- **Account with an eKYC provider** (e.g., Digio, Surepass, IDfy, Karza)
- `EKYC_API_KEY` — API key
- `EKYC_API_SECRET` — API secret (if applicable)
- Confirm verification types needed: Aadhaar OTP, PAN verification, or both
- Estimated cost: ~₹40 per verification

---

## 4. WhatsApp Business API

- `WHATSAPP_PHONE_NUMBER_ID` — from Meta Business Manager
- `WHATSAPP_ACCESS_TOKEN` — permanent System User token (not temporary)
- Pre-approved message templates (we'll provide template names and content)
- **OR** Wati/Interakt account credentials if using those instead

---

## 5. SendGrid (Transactional Email) — if replacing Gmail SMTP

- `SENDGRID_API_KEY` — from SendGrid dashboard
- Verified sender domain or email address
- *(Optional — can continue with Gmail SMTP for now, but SendGrid recommended for production)*

---

## 6. WooCommerce — CONFIGURED

- `WOO_URL` = `https://sb-ek.com`
- `WOO_CONSUMER_KEY` = configured in .env
- `WOO_CONSUMER_SECRET` = configured in .env
- `WOO_WEBHOOK_SECRET` — still needs to be set (we define this ourselves when creating our automation webhook in WooCommerce admin)

### Existing Shiprocket Webhooks on WooCommerce

These are pre-existing webhooks set up by Shiprocket. **Do NOT modify or delete them.**

| Webhook | URL | Purpose |
|---------|-----|---------|
| SR Order Created | `https://sr-go.shiprocket.in/wc/order/9511457` | Syncs new orders to Shiprocket |
| SR Order Updated | `https://sr-go.shiprocket.in/wc/order/9511457` | Syncs order updates to Shiprocket |
| SR Product Updated | `https://sr-channel.shiprocket.in/v1/channel/woocommerce/product/9511457` | Syncs product changes to Shiprocket |

### SBEK Automation Webhook (TODO)

When deploying to production, create a new webhook in WooCommerce admin:
- **Topic**: Order created / Order updated
- **Delivery URL**: `https://<your-server>/api/webhooks/woocommerce`
- **Secret**: Set the same value as `WOO_WEBHOOK_SECRET` in .env
- **Status**: Active

---

## 7. Google Cloud (Already Partially Configured)

- Service account JSON key file (for Sheets + Drive API)
- `GOOGLE_SHEET_ID` — spreadsheet ID for operations tracking
- Spreadsheet must be shared with the service account email

---

## 8. OpenAI / OpenRouter (Already Partially Configured)

- `OPENAI_API_KEY` — with billing enabled
- Confirm budget/spending limits for GPT-4o + image generation

---

## 9. Postiz (Social Media — Already Partially Configured)

- `POSTIZ_API_KEY`
- Connected Instagram and Facebook accounts in Postiz dashboard

---

## 10. Cloud Hosting / Deployment

- **AWS or GCP account** with billing enabled
- Domain name for the customer app (e.g., app.sbek.com or sbek.in)
- SSL certificate (or use Let's Encrypt / Cloudflare)
- Confirm deployment preference: AWS (EC2/ECS) or GCP (Cloud Run / GCE)

---

## 11. Brand Assets

- Hi-res logo (SVG + PNG)
- Brand color palette (primary, secondary, accent)
- Product catalog data export from WooCommerce (or API access is sufficient)
- Product photography / media assets
- Brand fonts (if any specific ones are used)

---

## Priority Order

| Priority | Credential | Needed For | Blocks |
|----------|-----------|------------|--------|
| P0 | Razorpay | Checkout & payments | Customer app launch |
| P0 | Tripo API | Design Studio | Core feature |
| DONE | WooCommerce (live) | Product catalog | REST API keys configured |
| P1 | eKYC provider | Marketplace seller verification | Marketplace launch |
| P1 | Cloud hosting account | Deployment | Production launch |
| P1 | Domain + SSL | Customer app URL | Production launch |
| P2 | SendGrid | Production email | Can start with Gmail SMTP |
| P2 | Brand assets | UI design | Can use placeholders initially |
| Already have | WhatsApp, Google, OpenAI, Postiz | Automation system | Already configured |
