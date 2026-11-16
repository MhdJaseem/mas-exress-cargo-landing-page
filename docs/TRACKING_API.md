# Tracking & pickup API contract

The front end is ready; the backend is not. This is the contract `src/lib/api.ts` expects (the `TrackingResult`, `PickupRequest` and `JobApplication` types there mirror it).

## 1. Track a shipment (live: the MAS billing app)

Tracking comes from the MAS billing app (its `app/api/track/route.ts`), public, no sign-in:

`GET {VITE_API_BASE}/api/track?id=MAS1234567890`

**200 response**

```json
{
  "trackingId": "MAS1234567890",
  "destination": "India",
  "latest": { "status": "in_transit", "label": "In transit", "location": "Dubai", "time": "2026-11-16T08:10:00.000Z" },
  "events": [
    { "status": "booked", "label": "Booked", "location": null, "time": "2026-11-14T06:00:00.000Z" },
    { "status": "in_transit", "label": "In transit", "location": "Dubai", "time": "2026-11-16T08:10:00.000Z" }
  ]
}
```

- **400** `{ "error": "Enter a tracking number like MAS1234567890." }` · **404** `{ "error": "No shipment found with this tracking number." }`.
  `trackShipment()` throws with that message and the home page shows it as the Last Status.
- Tracking numbers are `MAS` + 10 digits (printed on the invoice). It never returns names, phones, addresses or money,
  so Shipper / Consignee stay empty.
- `trackShipment()` maps the statuses onto the six steps (`STAGE` in `src/lib/api.ts`, `STEPS` in
  `src/components/tracking/TrackingSection.tsx`) and shows times in Dubai time, newest first.
- The billing app only answers this site's origin (CORS): its `TRACKING_URL` setting must be `https://<this site>/track/`.
- **`/track/MAS1234567890`** on this site (the QR code printed on MAS invoices) opens the tracking page (`src/pages/TrackPage.tsx`)
  with that shipment looked up. `/track` on its own shows the search form; every search goes to `/track/<no>`.

## 2. Request pickup

`POST {VITE_API_BASE}/api/pickup`

```json
{ "phone": "+971 501234567", "mode": "Air Freight", "date": "2026-10-25", "time": "10:00" }
```

Responses: `201 {id}`; `400 {errors:[...]}`. Server should (a) store the request, (b) email ops, (c) optionally notify via WhatsApp Business API. Add a honeypot field + rate limit/CAPTCHA to prevent spam.

## Security & privacy

CORS allow-list the site origin only · HTTPS only · validate/sanitise all fields server-side · no PII in URLs or logs · privacy note near the pickup form once data is stored.

## Backend options

| Option                                                                                         | When                                                     |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Serverless (Cloudflare Workers / Vercel / Netlify functions) + managed DB (Supabase, Firebase) | Fastest; low ops                                         |
| Node (Express/Fastify) + PostgreSQL on a small VPS                                             | Full control, integrates with an internal system         |
| Connect to existing logistics/ERP system via its API                                           | If MAS already has a shipment system — **confirm first** |

## 3. Job application (careers page)

`POST {VITE_API_BASE}/api/apply` as `multipart/form-data`: `name`, `email`, `phone`, `experience`, `cv` (PDF/DOC, max ~5 MB).
Responses: `201 {id}`; `400 {errors:[...]}`. Until this exists, `submitApplication()` in `src/lib/api.ts` opens an email draft to masexpresscargodubai@gmail.com and asks the applicant to attach the CV by hand (a mailto link cannot carry attachments). Confirm the recipient address with MAS. Scan uploads and never expose them publicly.
