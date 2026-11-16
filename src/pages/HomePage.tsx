import { useNavigate } from 'react-router';
import { HeroSection } from '../components/home/HeroSection';
import { AboutSection } from '../components/home/AboutSection';
import { ServicesSection } from '../components/home/ServicesSection';
import { WhySection } from '../components/home/WhySection';
import { TestimonialsSection } from '../components/home/TestimonialsSection';
import { PickupContactSection } from '../components/home/PickupContactSection';
import { normalizeTrackingNo } from '../lib/api';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useHomeScroll } from '../hooks/useHomeScroll';
import { useReveal } from '../hooks/useReveal';

/**
 * Home page. Its sections are direct children of <main> and carry the `stack` class:
 * on ≥900px they become sticky cards that slide over each other (hooks/useHomeScroll).
 */
export default function HomePage() {
  useDocumentMeta(
    'Mas Express Cargo – Transportation across the GCC and worldwide',
    'MAS Express Cargo specializes in secure, reliable, and timely transportation across the GCC and worldwide.',
  );
  useReveal('home');
  useHomeScroll();

  const navigate = useNavigate();
  // a search opens the tracking page with that number (pages/TrackPage.tsx); the page change animates
  // with the View Transitions API where supported (::view-transition rules in main.css)
  const track = (no: string) =>
    navigate(`/track/${encodeURIComponent(normalizeTrackingNo(no))}`, { viewTransition: true });

  return (
    <>
      <HeroSection onTrack={track} />
      <AboutSection />
      <ServicesSection />
      <WhySection />
      <TestimonialsSection />
      <PickupContactSection />
    </>
  );
}
