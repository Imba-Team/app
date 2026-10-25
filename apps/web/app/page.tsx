import type { Metadata } from 'next';

import { inter } from './_components/landing/fonts';
import { Hero } from './_components/landing/hero';
import { WhyItWorks } from './_components/landing/whyItWorks';
import { HowItWorks } from './_components/landing/howItWorks';
import { Features } from './_components/landing/features';
import { Faq } from './_components/landing/faq';
import { FinalCta } from './_components/landing/finalCta';
import { FooterSection } from './_components/footerSection';

const title = 'Mimir — Study less. Remember more.';
const description =
  "Mimir brings each card back right before you'd forget it, so every minute you spend reviewing actually sticks.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: 'website', siteName: 'Mimir' },
};

export default function LandingPage() {
  return (
    <div className={`${inter.variable} font-body`}>
      <main>
        <Hero />
        <WhyItWorks />
        <HowItWorks />
        <Features />
        <Faq />
        <FinalCta />
      </main>
      <FooterSection />
    </div>
  );
}
