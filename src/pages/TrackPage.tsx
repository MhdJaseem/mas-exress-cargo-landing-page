import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageHero } from '../components/ui/PageHero';
import { Icon } from '../components/ui/Icon';
import { TrackingSection } from '../components/tracking/TrackingSection';
import { normalizeTrackingNo, trackShipment, TRACKING_UNAVAILABLE, type TrackingResult } from '../lib/api';
import { CONTACT, pageTitle } from '../lib/site';
import { scrollToId } from '../lib/scroll';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useReveal } from '../hooks/useReveal';

/**
 * Shipment tracking page.
 *   /track        search form only
 *   /track/<no>   that shipment looked up straight away (the QR code on MAS invoices, and every search)
 * A search navigates to /track/<no>, so results have a shareable URL and back/forward step between searches.
 * <main> is keyed by path, so a new number is a fresh mount; the same number again is re-fetched by `search`.
 */
export default function TrackPage() {
  useDocumentMeta(
    pageTitle('Track Your Shipment'),
    'Track your MAS Express Cargo shipment: enter your tracking number to see its latest status and history.',
  );
  useReveal('inner');

  const { no: linkedNo } = useParams();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(linkedNo ?? '');
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // bumps on every lookup (also a repeat of the same number) and drives the effect below
  const [searches, setSearches] = useState(linkedNo ? 1 : 0);

  useEffect(() => {
    if (!linkedNo || !searches) return;
    let alive = true;
    setLoading(true);
    trackShipment(linkedNo)
      .then((r) => alive && setResult(r))
      .catch((e: unknown) => {
        // not found / wrong format / not available: shown as the Last Status in the result panel
        if (alive)
          setResult({
            no: normalizeTrackingNo(linkedNo),
            stage: -1,
            history: [],
            lastStatus: e instanceof Error ? e.message : TRACKING_UNAVAILABLE,
          });
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
        requestAnimationFrame(() => scrollToId('tracking'));
      });
    return () => {
      alive = false;
    };
  }, [linkedNo, searches]);

  // no number in the URL: put the cursor in the field
  useEffect(() => {
    if (!linkedNo) inputRef.current?.focus({ preventScroll: true });
  }, [linkedNo]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const id = normalizeTrackingNo(value.trim());
    if (!id) {
      setError('Please enter your tracking number.');
      inputRef.current?.focus();
      return;
    }
    setError('');
    if (linkedNo && normalizeTrackingNo(linkedNo) === id) setSearches((n) => n + 1);
    else navigate(`/track/${encodeURIComponent(id)}`, { viewTransition: true });
  }

  return (
    <>
      <PageHero
        image="/img/hero/hero-air.jpg"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Track Shipment' }]}
        title={['Track Your ', 'Shipment']}
        lead="Enter your tracking number to see your shipment's latest status, details and history."
      />
      <div className="pbody solo">
        <div className="main-col">
          <section className="blk">
            <form className="trk-search reveal" aria-label="Track Your Shipment" noValidate onSubmit={submit}>
              <label htmlFor="trk-page">Tracking No.</label>
              <div className="track">
                <input
                  ref={inputRef}
                  id="trk-page"
                  name="trk"
                  type="text"
                  inputMode="text"
                  placeholder="Enter Tracking No. (e.g. MAS1234567890)"
                  autoComplete="off"
                  required
                  aria-invalid={error ? true : undefined}
                  aria-describedby="trk-help"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? 'Tracking…' : 'Track'} <Icon name="arrow" />
                </button>
              </div>
              <p className="trk-help" id="trk-help" role="status">
                {error ||
                  (loading ? 'Looking up your shipment…' : 'Your tracking number is printed on your MAS invoice.')}
              </p>
              <p className="trk-call">
                <Icon name="phone" />
                Need help? Call us toll free on <a href={CONTACT.tollFree.href}>{CONTACT.tollFree.label}</a>
              </p>
            </form>
          </section>
          <TrackingSection result={result} />
        </div>
      </div>
    </>
  );
}
