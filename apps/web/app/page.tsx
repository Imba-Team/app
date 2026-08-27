import Hero from './_components/landing/Hero';
import HowItWorks from './_components/landing/HowItWorks';
import Features from './_components/landing/Features';
import ProductShowcase from './_components/landing/ProductShowcase';
import TrustStrip from './_components/landing/TrustStrip';
import Faq from './_components/landing/Faq';
import FinalCta from './_components/landing/FinalCta';
import FooterSection from './_components/FooterSection';

export default function LandingPage() {
  return (
    <>
      <main className="mx-auto max-w-6xl space-y-20 px-6 py-12 sm:space-y-28 sm:px-8 sm:py-16">
        <Hero />
        <HowItWorks />
        <Features />
        <ProductShowcase />
        <TrustStrip />
        <Faq />
        <FinalCta />
      </main>
      <FooterSection />
    </>
  );
}
