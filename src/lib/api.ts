/* ------------------------------------------------------------------
   API layer: the ONLY place the site talks to a backend.
   Replace the bodies below when the tracking system / CRM is ready.
   Contract: docs/TRACKING_API.md
   ------------------------------------------------------------------ */

// The MAS billing app, which keeps the shipments, e.g. https://billing.masexpresscargo.com (no trailing slash).
// Set VITE_API_BASE in .env.local and on Vercel. Empty = tracking shows "not available yet".
export const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');

export interface TrackingEvent {
  date: string;
  activity: string;
  location: string;
}

export interface TrackingResult {
  no: string;
  lastStatusDate?: string;
  shipper?: string;
  consignee?: string;
  bookingDate?: string;
  lastStatus?: string;
  origin?: string;
  destination?: string;
  serviceType?: string;
  pieces?: number | string;
  weight?: string;
  /** Index of the current step in the progress bar, 0..6 (-1 = none). */
  stage: number;
  history: TrackingEvent[];
}

/** Shown in the result panel when the tracking service can't be reached (or isn't set up yet) */
export const TRACKING_UNAVAILABLE = 'Online tracking is not available right now. Please call us on +971 800 4786.';

/**
 * Billing app status → step in the progress bar (STEPS in components/tracking/TrackingSection.tsx).
 * On hold / returned don't move the bar; the latest status still shows as Last Status.
 */
const STAGE: Record<string, number> = {
  booked: 0,
  packed: 0,
  picked_up: 0,
  dispatched: 1,
  departed: 1,
  in_transit: 2,
  arrived_destination: 3,
  customs_clearance: 4,
  out_for_delivery: 5,
  delivered: 6,
};

/** The billing app's answer: GET {API_BASE}/api/track?id=MAS1234567890 (MAS billing, app/api/track/route.ts) */
interface BillingTracking {
  trackingId: string;
  origin?: string;
  destination: string;
  /** "Air", "Sea", "Road" … */
  serviceType?: string;
  pieces?: number;
  /** decimal strings, e.g. "100.00" */
  weightKg?: string;
  actualWeightKg?: string;
  /** yyyy-mm-dd */
  bookingDate?: string;
  /** shortened names, e.g. "Gowtham B." */
  shipper?: string;
  consignee?: string;
  latest: BillingEvent | null;
  events: BillingEvent[];
}
interface BillingEvent {
  status: string;
  label: string;
  location: string | null;
  /** ISO time */
  time: string;
}

const dubai = (iso: string, withTime = true) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  })
    .format(new Date(iso))
    .replace(',', '');

/** "2026-11-16" → "16/11/2026" (same format as the other dates) */
const ymd = (d: string) => {
  const m = /^(d{4})-(d{2})-(d{2})$/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
};

/** "100.00" → "100 kg"; missing or not a number → undefined (shown as —) */
const kg = (v?: string) => {
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n)
    ? `${n.toLocaleString('en-GB', { maximumFractionDigits: 2 })} kg`
    : undefined;
};

/** "mas 1234-567 890" → "MAS1234567890" */
export const normalizeTrackingNo = (no: string) => no.toUpperCase().replace(/[\s-]/g, '');

/**
 * Look up a shipment in the MAS billing app. Throws an Error whose message is shown to the customer
 * (not found, wrong format, or tracking not available).
 * The billing app sends shortened shipper / consignee names only (no phones, addresses or money).
 */
export async function trackShipment(no: string): Promise<TrackingResult> {
  const id = normalizeTrackingNo(no);
  if (!API_BASE) throw new Error(TRACKING_UNAVAILABLE);

  let r: Response;
  try {
    r = await fetch(`${API_BASE}/api/track?id=${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } });
  } catch {
    throw new Error(TRACKING_UNAVAILABLE);
  }
  const data = (await r.json().catch(() => null)) as (BillingTracking & { error?: string }) | null;
  // 400: not a tracking number; 404: no such shipment (the billing app words both)
  if (!r.ok || !data) throw new Error(data?.error || TRACKING_UNAVAILABLE);

  const events = data.events ?? [];
  const stage = Math.max(-1, ...events.map((e) => STAGE[e.status] ?? -1));
  return {
    no: data.trackingId,
    lastStatus: data.latest?.label,
    lastStatusDate: data.latest ? dubai(data.latest.time) : undefined,
    bookingDate: data.bookingDate ? ymd(data.bookingDate) : events[0] ? dubai(events[0].time, false) : undefined,
    shipper: data.shipper,
    consignee: data.consignee,
    origin: data.origin || 'UAE',
    destination: data.destination,
    serviceType: data.serviceType,
    pieces: data.pieces,
    weight: kg(data.weightKg),
    stage,
    // newest first
    history: events
      .slice()
      .reverse()
      .map((e) => ({ date: dubai(e.time), activity: e.label, location: e.location ?? '—' })),
  };
}

export interface PickupRequest {
  /** Branch that should handle the pickup (name from data/company.ts branches) */
  b: string;
  /** That branch's WhatsApp number in wa.me format (digits with country code); '' falls back to the main support number */
  wa: string;
  /** Country code option text, e.g. "🇦🇪 UAE (+971)" */
  cc: string;
  /** Phone number */
  n: string;
  /** Pickup address */
  a: string;
  /** Shipment mode */
  m: string;
  /** Pickup date, yyyy-mm-dd */
  d: string;
  /** Pickup time, hh:mm */
  t: string;
}

// Main support WhatsApp (src/lib/site.ts), used when a branch has no WhatsApp number.
const PICKUP_WA_FALLBACK = '971506444786';

/**
 * Submit a pickup request. Returns the message shown under the form.
 * No backend yet: opens WhatsApp (app on phones, WhatsApp Web on desktop) to the selected branch's
 * number with the pickup details prefilled; the customer taps Send. Swap for a POST to your backend
 * (or the WhatsApp Business API) when one exists.
 */
export function submitPickup(f: PickupRequest): string {
  const text = [
    'Hello MAS Express Cargo, I would like to request a pickup.',
    '',
    'Branch: ' + f.b,
    // Flag emoji dropped: WhatsApp shows it as letters or a broken symbol on some devices.
    'Phone: ' + f.cc.replace(/\p{Regional_Indicator}/gu, '').trim() + ' ' + f.n,
    'Pickup Address: ' + f.a,
    'Shipment Mode: ' + f.m,
    'Pickup Date: ' + f.d,
    'Pickup Time: ' + f.t,
  ].join('\n');
  const href = 'https://wa.me/' + (f.wa || PICKUP_WA_FALLBACK) + '?text=' + encodeURIComponent(text);
  // New tab so the site stays open on desktop; if a popup blocker stops it, open WhatsApp in this tab.
  const w = window.open(href, '_blank');
  if (w) w.opener = null;
  else window.location.href = href;
  return 'Opening WhatsApp with your pickup details. Tap Send to send it to the branch.';
}

export interface ContactMessage {
  first: string;
  last: string;
  email: string;
  subject: string;
  message: string;
}

// Inbox that receives "Send a Message" enquiries. Temporary test address: switch to the company inbox before launch.
const MESSAGE_TO = 'mohammed.jaseem.a.2002@gmail.com';

/**
 * Submit a "Send a Message" enquiry (home Contact card). Resolves when the email has been sent.
 * Sent through FormSubmit (formsubmit.co), which needs no backend. The very first submission makes
 * FormSubmit email MESSAGE_TO an activation link; nothing is delivered until that link is clicked.
 * Swap for a POST to your backend / CRM when one exists.
 */
export async function submitMessage(f: ContactMessage): Promise<void> {
  const name = (f.first + ' ' + f.last).trim();
  const r = await fetch('https://formsubmit.co/ajax/' + MESSAGE_TO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      _subject: 'Website enquiry: ' + f.subject + ' - ' + name,
      _replyto: f.email,
      _template: 'table',
      _captcha: 'false',
      Name: name,
      'Email Address': f.email,
      Subject: f.subject,
      Message: f.message,
    }),
  });
  const data = (await r.json().catch(() => ({}))) as { success?: string | boolean; message?: string };
  if (!r.ok || String(data.success) !== 'true')
    throw new Error(data.message || 'Message not sent (HTTP ' + r.status + ')');
}

export interface JobApplication {
  name: string;
  email: string;
  phone: string;
  exp: string;
  /** Selected CV file name, or '' */
  cv: string;
}

/**
 * Submit a job application (careers page). Returns the message shown under the form.
 * No backend yet: opens an email draft. A mailto link cannot carry attachments,
 * so the applicant is asked to attach the CV themselves.
 * Swap for a multipart POST to `${API_BASE}/api/apply` (see docs/TRACKING_API.md).
 */
export function submitApplication(f: JobApplication): string {
  const body =
    'Job application%0D%0A%0D%0AFull Name: ' +
    encodeURIComponent(f.name) +
    '%0D%0AEmail Address: ' +
    encodeURIComponent(f.email) +
    '%0D%0APhone Number: ' +
    encodeURIComponent(f.phone) +
    '%0D%0AExperience: ' +
    encodeURIComponent(f.exp) +
    (f.cv ? '%0D%0ACV: ' + encodeURIComponent(f.cv) + ' (attached)' : '');
  window.location.href =
    'mailto:masexpresscargodubai@gmail.com?subject=' +
    encodeURIComponent('Job Application - ' + f.name) +
    '&body=' +
    body;
  return 'Opening your email app with your application. Please attach your CV to the email before sending.';
}
