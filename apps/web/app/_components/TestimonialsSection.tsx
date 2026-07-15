import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Emin Dabahov",
    role: "Medical Student",
    avatar: "ED",
    content:
      "Imba Learn helped me pass my MCAT with a score in the 99th percentile. The spaced repetition algorithm is incredible!",
    rating: 5,
  },
  {
    name: "Leyla Aliyeva",
    role: "High School Teacher",
    avatar: "LA",
    content:
      "I create flashcard sets for my students and share them instantly. Their test scores have improved by an average of 20%.",
    rating: 5,
  },
  {
    name: "Diana",
    role: "Language Learner",
    avatar: "D",
    content:
      "I learned conversational Japanese in 6 months using Imba Learn. The audio flashcards and practice tests are amazing.",
    rating: 5,
  },
];

const TestimonialsSection = () => {
  return (
    <section id="testimonials" className="py-20 md:py-32 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-4">
            Loved by Millions of Students
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See what our community has to say about their learning journey.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((testimonial, idx) => (
            <div
              key={idx}
              className="bg-card p-8 rounded-2xl border border-border hover:shadow-card transition-all duration-300"
            >
              <div className="flex items-center gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-5 h-5 fill-amber-300 text-amber-300"
                  />
                ))}
              </div>
              <p className="text-foreground mb-6">
                &quot;{testimonial.content}&quot;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#4255FF]/10 rounded-full flex items-center justify-center font-bold text-[#4255FF]">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-semibold text-foreground">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {testimonial.role}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
