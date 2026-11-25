# Tracking & pickup API contract

The front end is ready; the backend is not. This is the contract `src/lib/api.ts` expects (the `TrackingResult`, `PickupRequest` and `JobApplication` types there mirror it).

## 1. Track a shipment (live: the MAS billing app)

Tracking comes from the MAS billing app (its `app/api/track/route.ts`), public, no sign-in:

`GET {API_BASE}/api/track?id=MAS1234567890`

**200 response**

```json
{
  "trackingId": "MAS1234567890",
  "origin": "UAE",
  "destination": "India",
  "serviceType": "Air",
  "pieces": 1,
  "weightKg": "100.00",
  "actualWeightKg": "100.00",
  "bookingDate": "2026-11-16",
  "shipper": "Gowtham B.",
  "consignee": "Mohammed A.",
  "latest": {
    "status": "customs_clearance",
    "label": "Customs clearance",
    "location": "DXB",
    "time": "2026-11-16T19:05:00.000Z"
  },
  "events": [
    { "status": "booked", "label": "Booked", "location": "Murar", "time": "2026-11-16T06:19:50.088Z" },
    {
      "status": "picked_up",
      "label": "Picked up from branch",
      "location": "Murar",
      "time": "2026-11-16T08:57:52.063Z"
    },
    {
      "status": "customs_clearance",
      "label": "Customs clearance",
      "location": "DXB",
      "time": "2026-11-16T19:05:00.000Z"
    }
  ],
  "handover": { "company": "UPS", "trackingNo": "1Z999AA1", "url": "https://www.ups.com/track?tracknum=1Z999AA1" }
}
```

- **400** `{ "error": "Enter a tracking number like MAS1234567890." }` · **404** `{ "error": "No shipment found with this tracking number." }`.
  `trackShipment()` throws with that message and the tracking page shows it as the Last Status.
- Tracking numbers are `MAS` + 10 digits (printed on the invoice). Shipper / consignee are shortened names only; it never
  returns phones, addresses or money. Weights are shown as "100 kg", `bookingDate` as dd/mm/yyyy.
- `trackShipment()` maps the statuses onto the seven steps (booked / packed / picked_up → Booked & Dispatch, dispatched / departed → Departed,
  in_transit → In Transit, arrived_destination → Arrived, customs_clearance → Customs Clearance,
  out_for_delivery → Out for Delivery, delivered → Delivered; `STAGE` in `src/lib/api.ts`, `STEPS` in
  `src/components/tracking/TrackingSection.tsx`). It shows times in Dubai time, newest first.
- **`handover`** is `null` until MAS hands the shipment to the delivery company at the destination (operations type that
  company's tracking number in the billing app, Shipments → Delivery tracking). Then it carries the company's name, its
  number and `url`, a link to the company's own tracking page (`null` when MAS has no link for that company). The result
  panel shows a "Handed over to … for delivery" card above the summary with a **Track on …** button (new tab); without a
  link it shows the number and asks the customer to track it on the company's website. The MAS history stays below.
- The billing app only answers this site's origin (CORS): its `TRACKING_URL` setting must be `https://<this site>/track/`.
- **`/track/MAS1234567890`** on this site (the QR code printed on MAS invoices) opens the tracking page (`src/pages/TrackPage.tsx`)
  with that shipment looked up. `/track` on its own shows the search form; every search goes to `/track/<no>`.

## 2. Request pickup

`POST {API_BASE}/api/pickup`

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

`POST {API_BASE}/api/apply` as `multipart/form-data`: `name`, `email`, `phone`, `experience`, `cv` (PDF/DOC, max ~5 MB).
Responses: `201 {id}`; `400 {errors:[...]}`. Until this exists, `submitApplication()` in `src/lib/api.ts` opens an email draft to masexpresscargodubai@gmail.com and asks the applicant to attach the CV by hand (a mailto link cannot carry attachments). Confirm the recipient address with MAS. Scan uploads and never expose them publicly.
