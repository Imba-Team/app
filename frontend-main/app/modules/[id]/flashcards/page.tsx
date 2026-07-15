"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Lightbulb, Star, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Term } from "@/lib/types/term.type";
import { useModule } from "@/lib/hooks/useModules";
import { useUpdateTerm } from "@/lib/hooks/useTerms";

const shuffleArray = (arr: Term[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default function FlashcardsClient() {
  const params = useParams();
  const moduleId = params.id as string;

  const { data: moduleData, isLoading: moduleLoading } = useModule(moduleId);
  // const { data: termsData = [], isLoading: termsLoading } = useTerms(moduleId);
  const updateTerm = useUpdateTerm();

  const [terms, setTerms] = useState<Term[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showOnlyStarred, setShowOnlyStarred] = useState(false);
  const initializeRef = useRef(false);
  const [, startTransition] = useTransition();

  const loading = moduleLoading;
  const moduleInfo = moduleData?.data
    ? {
        title: moduleData.data.title,
        description: moduleData.data.description,
      }
    : null;

  useEffect(() => {
    if (moduleData?.data?.terms.length > 0 && !initializeRef.current) {
      initializeRef.current = true;
      startTransition(() => {
        setTerms(shuffleArray(moduleData.data.terms));
      });
    }
  }, [moduleData, startTransition]);

  useEffect(() => {
    // Reset index and flip when data changes or filter changes
    startTransition(() => {
      setIndex(0);
      setFlipped(false);
      setShowHint(false);
    });
  }, [terms, showOnlyStarred, startTransition]);

  const toggleStar = (term: Term) => {
    updateTerm.mutate({
      id: term.id,
      data: { isStarred: !term.isStarred },
    });
    setTerms((prev) =>
      prev.map((w) =>
        w.id === term.id ? { ...w, isStarred: !w.isStarred } : w
      )
    );
  };

  const getHint = (term: string) => {
    const words = term.trim().split(" ");
    if (words.length === 1) {
      const w = words[0];
      if (w.length <= 4) return `${w[0]}...`;
      return `${w.slice(0, 3)}...`;
    }
    return `${words.slice(0, Math.ceil(words.length / 2)).join(" ")}…`;
  };

  const speak = (text: string) => {
    if (typeof window === "undefined") return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 1;
    utter.pitch = 1;
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  };

  const filteredTerms = useMemo(() => {
    if (showOnlyStarred) {
      return terms.filter((term) => term.isStarred);
    }
    return terms;
  }, [terms, showOnlyStarred]);

  const current = useMemo(() => filteredTerms[index], [filteredTerms, index]);

  if (loading) return <p className="text-center mt-20">Loading terms...</p>;
  if (!current)
    return (
      <p className="text-center mt-20">
        {showOnlyStarred ? "No starred terms found" : "No terms found"}
      </p>
    );

  return (
    <>
      <main className="overflow-x-hidden bg-gray-100 min-h-screen">
        {moduleInfo && (
          <div className="text-[#4255FF] pt-10 mb-8 max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold">{moduleInfo.title}</h1>
            <p className="text-gray-600 mt-4">{moduleInfo.description}</p>
          </div>
        )}
        <div className="flex flex-col items-center">
          <hr className=" w-full max-w-4xl mb-8 border-gray-300" />

          {/* Filter Button */}
          <div className="w-full max-w-4xl mb-6 flex justify-end">
            <Button
              variant={showOnlyStarred ? "default" : "outline"}
              onClick={() => setShowOnlyStarred(!showOnlyStarred)}
              className="flex items-center gap-2 rounded-full px-6"
            >
              <Star
                size={18}
                className={showOnlyStarred ? "fill-current" : ""}
              />
              {showOnlyStarred ? "Show All Terms" : "Show Only Starred"}
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-start pt-10 p-6 flex-1">
          <div
            className="relative w-full max-w-[650px] h-[60vh] sm:h-[400px]"
            style={{ perspective: "1200px" }}
          >
            <div
              className={`relative w-full h-full transition-transform duration-500 cursor-pointer ${
                flipped ? "rotate-y-180" : ""
              }`}
              style={{ transformStyle: "preserve-3d" }}
              onClick={() => setFlipped((v) => !v)}
            >
              {/* Front side */}
              <div
                className="absolute w-full h-full bg-white rounded-3xl shadow-lg flex flex-col p-6"
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      className="text-gray-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowHint((v) => !v);
                      }}
                      aria-label="Toggle hint"
                    >
                      <Lightbulb size={26} />
                    </button>
                    {showHint && (
                      <div className="text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded-lg shadow">
                        {getHint(current.definition)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      className="text-gray-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        speak(current.term);
                      }}
                      aria-label="Play term"
                    >
                      <Volume2 size={24} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStar(current);
                      }}
                      aria-label="Toggle favorite"
                    >
                      <Star
                        size={26}
                        className={
                          current.isStarred
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-gray-400"
                        }
                      />
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-center text-4xl font-semibold p-6">
                  {current.term}
                </div>
              </div>

              {/* Back side */}
              <div
                className="absolute w-full h-full bg-white rounded-3xl shadow-lg flex flex-col p-6 rotate-y-180"
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="flex items-center justify-end gap-3">
                  <button
                    className="text-gray-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      speak(current.definition);
                    }}
                    aria-label="Play definition"
                  >
                    <Volume2 size={24} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStar(current);
                    }}
                    aria-label="Toggle favorite"
                  >
                    <Star
                      size={26}
                      className={
                        current.isStarred
                          ? "text-yellow-400 fill-yellow-400"
                          : "text-gray-400"
                      }
                    />
                  </button>
                </div>

                <div className="flex-1 flex items-center justify-center text-2xl p-6 text-center leading-relaxed">
                  {current.definition}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-8">
            <Button
              variant="default"
              className="px-10 rounded-full"
              onClick={() => {
                setFlipped(false);
                setShowHint(false);
                setIndex((i) => Math.max(0, i - 1));
              }}
            >
              <span className="flex gap-x-2 items-center">
                <ArrowLeft />
                Prev
              </span>
            </Button>

            <Button
              variant="default"
              className="px-10 rounded-full"
              onClick={() => {
                setFlipped(false);
                setShowHint(false);
                setIndex((i) => Math.min(filteredTerms.length - 1, i + 1));
              }}
            >
              <span className="flex gap-x-2 items-center">
                Next
                <ArrowRight />
              </span>
            </Button>
          </div>

          <div className="mt-10 flex">
            <Button
              variant="link"
              onClick={() => (window.location.href = `/modules/${moduleId}`)}
              className="flex items-center gap-2 text-[#4255FF] text-lg"
            >
              <ArrowLeft size={20} /> Back to terms
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
