"use client";

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useTransition,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Lightbulb, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Term } from "../types";
import { useModule } from "@/lib/hooks/useModules";
import {
  useTerms,
  useUpdateTerm,
  useUpdateTermStatus,
} from "@/lib/hooks/useTerms";

const shuffleArray = <T,>(arr: T[]): T[] => {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

interface QuizAnswer {
  termId: string;
  isCorrect: boolean;
}

export default function QuizClient() {
  const params = useParams();
  const router = useRouter();
  const moduleId = params.id as string;

  const { data: moduleData, isLoading: moduleLoading } = useModule(moduleId);
  // const { data: termsData = [], isLoading: termsLoading } = useTerms(moduleId);
  const termsData = useMemo(() => moduleData?.data.terms || [], [moduleData]);
  const updateTerm = useUpdateTerm();
  const updateTermStatus = useUpdateTermStatus();

  const [quizTerms, setQuizTerms] = useState<Term[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showOnlyStarred, setShowOnlyStarred] = useState(false);
  const hasSubmittedRef = useRef(false);
  const [, startTransition] = useTransition();

  const loading = moduleLoading;

  const moduleInfo = useMemo(
    () =>
      moduleData?.data
        ? {
            title: moduleData.data.title,
            description: moduleData.data.description,
          }
        : null,
    [moduleData]
  );

  // Initialize quiz terms once when data loads or filter changes
  useEffect(() => {
    if (termsData.length > 0) {
      startTransition(() => {
        const filteredData = showOnlyStarred
          ? termsData.filter((term: Term) => term.isStarred)
          : termsData;
        setQuizTerms(shuffleArray(filteredData));
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setIsAnswerCorrect(null);
        setQuizAnswers([]);
        setIsFinished(false);
        setShowHint(false);
        hasSubmittedRef.current = false;
      });
    }
  }, [termsData, showOnlyStarred, startTransition]);

  const currentTerm = quizTerms[currentIndex];
  const totalQuestions = quizTerms.length;

  // Generate answer options for current term
  const answerOptions = useMemo(() => {
    if (!currentTerm || quizTerms.length === 0) return [];

    const wrongAnswers = shuffleArray(
      quizTerms.filter((t) => t.id !== currentTerm.id)
    )
      .slice(0, 3)
      .map((t) => t.definition);

    return shuffleArray([currentTerm.definition, ...wrongAnswers]);
  }, [currentTerm, quizTerms]);

  const toggleStar = useCallback(
    (term: Term) => {
      updateTerm.mutate({
        id: term.id,
        data: { isStarred: !term.isStarred },
      });
      setQuizTerms((prev) =>
        prev.map((t) =>
          t.id === term.id ? { ...t, isStarred: !term.isStarred } : t
        )
      );
    },
    [updateTerm]
  );

  const handleAnswerSelect = useCallback(
    (answer: string) => {
      if (!currentTerm || selectedAnswer) return;

      setSelectedAnswer(answer);
      const isCorrect = answer === currentTerm.definition;
      setIsAnswerCorrect(isCorrect);

      // Record answer for later submission
      setQuizAnswers((prev) => [
        ...prev,
        { termId: currentTerm.id, isCorrect },
      ]);

      // Move to next question after delay
      setTimeout(() => {
        if (currentIndex === totalQuestions - 1) {
          setIsFinished(true);
        } else {
          setCurrentIndex((i) => i + 1);
          setSelectedAnswer(null);
          setIsAnswerCorrect(null);
          setShowHint(false);
        }
      }, 1000);
    },
    [currentTerm, selectedAnswer, currentIndex, totalQuestions]
  );

  // Submit results when quiz is finished (only once)
  useEffect(() => {
    if (isFinished && quizAnswers.length > 0 && !hasSubmittedRef.current) {
      hasSubmittedRef.current = true;

      // Submit all answers at once
      Promise.all(
        quizAnswers.map(({ termId, isCorrect }) =>
          updateTermStatus.mutateAsync({ id: termId, success: isCorrect })
        )
      ).catch((error) => {
        console.error("Failed to submit quiz results:", error);
        hasSubmittedRef.current = false; // Allow retry on error
      });
    }
  }, [isFinished, quizAnswers, updateTermStatus]);

  const handleRetry = useCallback(() => {
    const filteredData = showOnlyStarred
      ? termsData.filter((term: Term) => term.isStarred)
      : termsData;
    setQuizTerms(shuffleArray(filteredData));
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setIsAnswerCorrect(null);
    setQuizAnswers([]);
    setIsFinished(false);
    setShowHint(false);
    hasSubmittedRef.current = false; // Reset submission flag
  }, [termsData, showOnlyStarred]);

  const getHint = useCallback((text: string) => {
    const words = text.trim().split(" ");
    if (words.length === 1) {
      const word = words[0];
      return word.length <= 4 ? `${word[0]}...` : `${word.slice(0, 3)}...`;
    }
    return `${words.slice(0, Math.ceil(words.length / 2)).join(" ")}…`;
  }, []);

  const score = quizAnswers.filter((a) => a.isCorrect).length;
  const progressPercent =
    totalQuestions > 0 ? Math.round((currentIndex / totalQuestions) * 100) : 0;

  if (loading) {
    return <p className="text-center mt-20">Loading quiz...</p>;
  }

  if (!currentTerm || quizTerms.length === 0) {
    return (
      <p className="text-center mt-20">
        {showOnlyStarred
          ? "No starred terms available for quiz"
          : "No terms available for quiz"}
      </p>
    );
  }

  return (
    <main className="bg-gray-100 min-h-screen overflow-x-hidden">
      {moduleInfo && (
        <div className="text-[#4255FF] pt-10 mb-8 max-w-4xl mx-auto px-4">
          <h1 className="text-4xl font-bold">{moduleInfo.title}</h1>
          <p className="text-gray-600 mt-4">{moduleInfo.description}</p>
        </div>
      )}

      <div className="flex flex-col items-center min-h-screen p-6">
        {/* Filter Button */}
        <div className="w-full max-w-4xl mb-6 flex justify-end">
          <Button
            variant={showOnlyStarred ? "default" : "outline"}
            onClick={() => setShowOnlyStarred(!showOnlyStarred)}
            className="flex items-center gap-2 rounded-full px-6"
          >
            <Star size={18} className={showOnlyStarred ? "fill-current" : ""} />
            {showOnlyStarred ? "Show All Terms" : "Show Only Starred"}
          </Button>
        </div>

        <div className="bg-white w-full max-w-4xl rounded-2xl shadow-lg p-8 pb-16 flex flex-col items-center">
          {!isFinished ? (
            <>
              {/* Progress bar */}
              <div className="w-full mb-6">
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-2 text-center">
                  Question {currentIndex + 1} of {totalQuestions}
                </p>
              </div>

              {/* Controls */}
              <div className="flex justify-between items-center w-full mb-4">
                <button
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                  onClick={() => setShowHint((v) => !v)}
                  aria-label="Toggle hint"
                  type="button"
                >
                  <Lightbulb size={26} />
                </button>
                <button
                  onClick={() => toggleStar(currentTerm)}
                  type="button"
                  aria-label="Toggle favorite"
                >
                  <Star
                    size={28}
                    className={
                      currentTerm.isStarred
                        ? "text-yellow-400 fill-yellow-400"
                        : "text-gray-400 hover:text-gray-600"
                    }
                  />
                </button>
              </div>

              {/* Hint */}
              {showHint && (
                <div className="self-start bg-gray-50 px-3 py-2 rounded-lg shadow-sm text-sm text-gray-600 mb-4">
                  {getHint(currentTerm.definition)}
                </div>
              )}

              {/* Question */}
              <h2 className="text-2xl font-bold mb-8 text-center">
                {currentTerm.term}
              </h2>

              {/* Answer options */}
              <div className="flex flex-col gap-3 w-full">
                {answerOptions.map((option) => {
                  const isSelected = selectedAnswer === option;
                  const showCorrect = isSelected && isAnswerCorrect;
                  const showIncorrect = isSelected && !isAnswerCorrect;

                  return (
                    <button
                      key={option}
                      onClick={() => handleAnswerSelect(option)}
                      disabled={selectedAnswer !== null}
                      className={`p-4 rounded-xl border-2 text-left transition-all disabled:cursor-not-allowed ${
                        showCorrect
                          ? "bg-green-100 border-green-500"
                          : showIncorrect
                          ? "bg-red-100 border-red-500"
                          : "bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            /* Quiz finished */
            <div className="text-center space-y-6">
              <h2 className="text-4xl font-bold mb-4">Quiz Complete! 🎉</h2>
              <div className="bg-blue-50 rounded-lg p-6">
                <p className="text-2xl font-semibold text-blue-900">
                  Your Score
                </p>
                <p className="text-5xl font-bold text-blue-600 mt-2">
                  {score} / {totalQuestions}
                </p>
                <p className="text-lg text-gray-600 mt-2">
                  {Math.round((score / totalQuestions) * 100)}% correct
                </p>
              </div>
              <div className="flex gap-4 justify-center mt-6">
                <Button
                  onClick={handleRetry}
                  variant="default"
                  size="lg"
                  className="px-8"
                >
                  Retry Quiz
                </Button>
                <Button
                  onClick={() => router.push(`/modules/${moduleId}`)}
                  variant="outline"
                  size="lg"
                  className="px-8"
                >
                  Back to Module
                </Button>
              </div>
            </div>
          )}
        </div>

        {!isFinished && (
          <div className="mt-6">
            <Button
              onClick={() => router.push(`/modules/${moduleId}`)}
              variant="link"
              className="flex items-center gap-2 text-[#4255FF] text-lg"
            >
              <ArrowLeft size={20} /> Back to terms
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
