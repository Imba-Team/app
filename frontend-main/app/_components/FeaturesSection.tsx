import { Brain, Zap, Users, Trophy, Clock, Shield } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Instant Feedback",
    description:
      "Get immediate results on practice tests and see detailed explanations for every answer.",
  },
  {
    icon: Users,
    title: "Study Together",
    description:
      "Share flashcard sets with friends and study together in real-time collaborative sessions.",
  },
  {
    icon: Trophy,
    title: "Track Progress",
    description:
      "Monitor your improvement with detailed analytics and achievement milestones.",
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-20 md:py-32 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-4">
            Everything You Need to Succeed
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful features designed to make studying more effective and
            enjoyable.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={idx}
                className="bg-card p-8 rounded-2xl border border-border hover:shadow-card transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-14 h-14 bg-[#4255FF]/10 rounded-xl flex items-center justify-center mb-6">
                  <Icon className="w-7 h-7 text-[#4255FF]" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground mb-3">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
