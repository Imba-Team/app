"use client";
import { useAuth } from "@/contexts/AuthContext";
import HeroSection from "./_components/HeroSection";
import FeaturesSection from "./_components/FeaturesSection";
import TestimonialsSection from "./_components/TestimonialsSection";
import { StudyModesSection } from "./_components/StudyModesSection";
import FooterSection from "./_components/FooterSection";

export default function Dashboard() {
  const auth = useAuth();

  return (
    <>
      <HeroSection
        isLoading={auth.isLoading}
        isAuthenticated={auth.isAuthenticated}
      />
      <StudyModesSection />
      <FeaturesSection />
      <TestimonialsSection />
      <FooterSection />
    </>
  );
}
