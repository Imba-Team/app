import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Play } from "lucide-react";
import Link from "next/link";

const HeroSection = ({
  isLoading,
  isAuthenticated,
}: {
  isLoading: boolean;
  isAuthenticated: boolean;
}) => {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden min-h-s">
      {/* Background decoration */}
      {/* <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan/30 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#4255FF]/20 rounded-full blur-3xl animate-float-delayed" />
        <div className="absolute top-40 right-1/4 w-48 h-48 bg-yellow/20 rounded-full blur-3xl animate-float" />
      </div> */}

      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[#4255FF]/10 text-[#4255FF] px-4 py-2 rounded-full mb-8 animate-fade-up ">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium ">
              The #1 learning platform for students (In ADA University)
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-extrabold text-foreground mb-6 animate-fade-up leading-tight">
            Master Anything with{" "}
            <span className="text-[#4255FF] rounded-lg px-2">
              Smart Learning
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-up-delayed">
            Join millions of students who use Imba Learn&apos;s interactive
            flashcards, practice tests, and AI-powered study tools to ace their
            exams and master new skills.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up-delayed">
            <Link
              href={isLoading ? "#" : isAuthenticated ? "/dashboard" : "/login"}
              className="bg-[#4255FF] text-white px-16 py-3 rounded-full text-lg font-semibold hover:scale-105 transition-transform duration-200"
            >
              {isLoading
                ? "Loading..."
                : isAuthenticated
                ? "Go to your dashboard"
                : "Login or register to get started"}
            </Link>
          </div>

          {/* Social Proof */}
          <div className="mt-12 animate-fade-up-delayed">
            <p className="text-sm text-muted-foreground mb-4">
              Trusted by students at top universities
            </p>
            <div className="flex items-center justify-center gap-8 opacity-60 grayscale">
              <div className="font-display font-bold text-lg">
                ADA University
              </div>
              <div className="font-display font-bold text-lg">
                Nazarbayev University
              </div>
              <div className="font-display font-bold text-lg">
                Khazar University
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
