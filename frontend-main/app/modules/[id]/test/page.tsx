"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Term } from "@/lib/types/term.type";
import { useModule } from "@/lib/hooks/useModules";
import { useTerms } from "@/lib/hooks/useTerms";

type Question =
  | { type: "written"; word: Term; id: string }
  | { type: "written2"; word: Term; id: string }
  | { type: "mc"; word: Term; options: string[]; id: string }
  | { type: "matching"; pairs: Term[]; id: string };

// (Answer map types removed as answers are not stored)

export default function TestPageClient() {
  const params = useParams<{ id: string; name?: string }>();
  const moduleId = params.id;

  const { data: moduleData } = useModule(moduleId);
  const { data: termsData = [] } = useTerms(moduleId);

  const [words, setWords] = useState<Term[]>([]);
  const [matchLeftSelected, setMatchLeftSelected] = useState<string | null>(
    null
  );
  const [matchRightOrder, setMatchRightOrder] = useState<string[]>([]);
  const [matchPairsGiven, setMatchPairsGiven] = useState<
    Record<string, string>
  >({});

  const moduleInfo = moduleData?.data
    ? {
        title: moduleData.data.title,
        description: moduleData.data.description,
      }
    : null;

  useEffect(() => {
    if (termsData.length > 0) {
      setWords(termsData);
    }
  }, [termsData]);

  const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
  const id = (prefix = "") =>
    `${prefix}${Math.random().toString(36).slice(2, 9)}`;

  const questions = useMemo<Question[]>(() => {
    if (!words || words.length === 0) return [];

    const shuffled = shuffle(words);
    const qs: Question[] = [];

    shuffled.forEach((w) => {
      if (Math.random() < 0.6) {
        const otherDefinitions = shuffle(
          words.filter((x) => x.term !== w.term).map((x) => x.definition)
        ).slice(0, Math.min(3, words.length - 1));
        const options = shuffle([w.definition, ...otherDefinitions]);

        qs.push({ type: "mc", word: w, options, id: id("mc-") });
      } else {
        if (Math.random() < 0.5) {
          qs.push({ type: "written", word: w, id: id("wr-") });
        } else {
          qs.push({ type: "written2", word: w, id: id("wr2-") });
        }
      }
    });

    if (words.length >= 2) {
      const insertAt = Math.max(1, Math.floor(qs.length / 2));
      const matchingPairs = shuffle(
        shuffled.slice(0, Math.min(6, shuffled.length))
      );
      qs.splice(insertAt, 0, {
        type: "matching",
        pairs: matchingPairs,
        id: id("mt-"),
      });
    }

    return qs;
  }, [words]);

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  // Removed unused answers state
  const [showResult, setShowResult] = useState(false);
  const [wrongList, setWrongList] = useState<
    { word: Term; correct: string; given?: string }[]
  >([]);
  const current = questions[index];
  const total = questions.length;

  useEffect(() => {
    setIndex(0);
    setScore(0);
    setShowResult(false);
    setWrongList([]);
  }, [questions.length]);
  useEffect(() => {
    if (current?.type === "matching") {
      setMatchRightOrder(shuffle(current.pairs.map((p) => p.definition)));
      setMatchLeftSelected(null);
      setMatchPairsGiven({});
    }
  }, [current]);
  if (!questions || questions.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <p>No words in this module.</p>
      </main>
    );
  }

  const handleSubmitWritten = (word: Term, value: string) => {
    const correct =
      value.trim().toLowerCase() === word.definition.trim().toLowerCase();
    if (correct) setScore((s) => s + 1);
    else
      setWrongList((arr) => [
        ...arr,
        { word, correct: word.definition, given: value },
      ]);
    // answers map removed (unused)
    next();
  };
  const handleSubmitWritten2 = (word: Term, value: string) => {
    const correct =
      value.trim().toLowerCase() === word.term.trim().toLowerCase();
    if (correct) setScore((s) => s + 1);
    else
      setWrongList((arr) => [
        ...arr,
        { word, correct: word.term, given: value },
      ]);
    // answers map removed (unused)
    next();
  };
  const handleSubmitMC = (choice: string) => {
    if (current?.type !== "mc") return;
    const correct = choice === current.word.definition;
    if (correct) setScore((s) => s + 1);
    else
      setWrongList((arr) => [
        ...arr,
        {
          word: current.word,
          correct: current.word.definition,
          given: choice,
        },
      ]);
    // answers map removed (unused)
    setTimeout(next, 350);
  };

  const handleMatchSelectLeft = (term: string) => {
    setMatchLeftSelected(term);
  };

  const handleMatchSelectRight = (definition: string) => {
    if (!matchLeftSelected) return;
    setMatchPairsGiven((m) => ({ ...m, [matchLeftSelected]: definition }));
    setMatchLeftSelected(null);
  };

  const submitMatching = () => {
    if (current?.type !== "matching") return;
    const pairs = current.pairs;
    let correctCount = 0;
    pairs.forEach((p) => {
      const given = matchPairsGiven[p.term];
      if (
        given &&
        given.trim().toLowerCase() === p.definition.trim().toLowerCase()
      ) {
        correctCount++;
      } else {
        setWrongList((arr) => [
          ...arr,
          { word: p, correct: p.definition, given: matchPairsGiven[p.term] },
        ]);
      }
    });
    setScore((s) => s + correctCount);
    // answers map removed (unused)
    next();
  };

  function next() {
    if (index + 1 >= total) {
      setShowResult(true);
    } else {
      setIndex((i) => i + 1);
    }
  }

  const progressPct = Math.round((index / total) * 100);
  return (
    <main className="min-h-screen overflow-x-hidden p-8 bg-gray-100">
      {moduleInfo && (
        <div className="text-[#4255FF] pt-10 mb-8 max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold">{moduleInfo.title}</h1>
          <p className="text-gray-600 mt-4">{moduleInfo.description}</p>
        </div>
      )}
      <div className="flex flex-col items-center">
        <hr className=" w-full max-w-4xl mb-8 border-gray-300" />
      </div>
      <header className="max-w-4xl mx-auto">
        <div className="w-full bg-gray-300 rounded-full h-2 mb-4">
          <div
            className="h-2 rounded-full bg-[#4255FF] transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Question {index + 1} / {total}
        </p>
      </header>

      <section className="max-w-4xl mx-auto">
        {!showResult && (
          <div className="bg-white rounded-2xl shadow p-8">
            {current.type === "written" && (
              <WrittenQuestion
                key={current.id}
                word={current.word}
                onSubmit={(val) => handleSubmitWritten(current.word, val)}
              />
            )}
            {current.type === "written2" && (
              <WrittenQuestion2
                key={current.id}
                word={current.word}
                onSubmit={(val) => handleSubmitWritten2(current.word, val)}
              />
            )}

            {current.type === "mc" && (
              <MCQuestion
                key={current.id}
                word={current.word}
                options={current.options}
                onChoose={handleSubmitMC}
              />
            )}

            {current.type === "matching" && (
              <div className="w-full max-w-2xl">
                <h3 className="text-lg font-semibold mb-3">Matching</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Click a term on the left, then its definition below.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    {current.pairs.map((p) => (
                      <button
                        key={p.term}
                        onClick={() => handleMatchSelectLeft(p.term)}
                        className={`w-full text-left p-3 rounded-xl mb-2 border ${
                          matchLeftSelected === p.term
                            ? "border-[#4255FF] bg-[#eef2ff]"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        {p.term}
                        <div className="text-sm text-gray-400"></div>
                      </button>
                    ))}
                  </div>

                  <div>
                    {current.pairs.map((p) => {
                      const assigned = matchPairsGiven[p.term];
                      return (
                        <motion.div
                          key={p.term}
                          layout
                          className="h-[52px] mb-2 flex items-center"
                        >
                          {assigned && (
                            <motion.button
                              layout
                              onClick={() => handleMatchSelectRight(assigned)}
                              className="w-full text-left p-3 rounded-xl border bg-[#eef2ff] border-[#4255FF]"
                            >
                              {assigned}
                            </motion.button>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 mt-6 justify-center w-full">
                  {matchRightOrder
                    .filter((t) => !Object.values(matchPairsGiven).includes(t))
                    .map((t) => (
                      <motion.button
                        key={t}
                        layout
                        onClick={() => handleMatchSelectRight(t)}
                        className="px-4 py-3 min-w-[210px] text-center rounded-xl border border-gray-200 bg-white"
                      >
                        {t}
                      </motion.button>
                    ))}
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    className="px-4 py-2 border rounded-xl"
                    onClick={() => {
                      setMatchPairsGiven({});
                      setMatchLeftSelected(null);
                    }}
                  >
                    Reset
                  </button>

                  <button
                    onClick={submitMatching}
                    className=" px-4 py-2 bg-[#4255FF] text-white rounded-xl"
                  >
                    Submit Matching
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {showResult && (
          <div className="bg-white rounded-2xl shadow p-6 text-center">
            <h2 className="text-3xl font-bold mb-2">Test completed 🎉</h2>
            <p className="text-gray-600 mb-4">Score: {score}</p>
            <p className="text-sm text-gray-500 mb-6">
              {wrongList.length === 0
                ? "Perfect! You got everything."
                : `You missed ${wrongList.length} items.`}
            </p>

            {wrongList.length > 0 && (
              <div className="text-left max-w-2xl mx-auto">
                <h3 className="font-semibold mb-2">Review</h3>
                <ul className="space-y-2">
                  {wrongList.map((w, i) => (
                    <li key={i} className="p-3 rounded-lg border">
                      <div className="font-semibold">{w.word.term}</div>
                      <div className="text-sm text-green-700">
                        Correct: {w.correct}
                      </div>
                      {w.given && (
                        <div className="text-sm text-red-600">
                          Your answer: {String(w.given)}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => {
                  window.location.reload();
                }}
                className="px-4 py-2 bg-[#4255FF] text-white rounded"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </section>
      <div className="mt-6 flex items-center justify-center">
        <button
          onClick={() => (window.location.href = `/modules/${moduleId}`)}
          className="ml-8 text-black flex items-center gap-2 text-lg"
        >
          <ArrowLeft size={20} /> Back to terms
        </button>
      </div>
    </main>
  );
}
function WrittenQuestion({
  word,
  onSubmit,
}: {
  word: Term;
  onSubmit: (val: string) => void;
}) {
  const [val, setVal] = useState("");
  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">
        Choose the correct definition
      </h3>
      <p className="text-2xl font-bold mb-4">{word.term}</p>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-full p-3 border rounded-lg mb-4"
        placeholder="Type definition..."
      />
      <div className="flex justify-end">
        <button
          onClick={() => onSubmit(val)}
          className="px-4 py-2 bg-[#4255FF] text-white rounded"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
function WrittenQuestion2({
  word,
  onSubmit,
}: {
  word: Term;
  onSubmit: (val: string) => void;
}) {
  const [val, setVal] = useState("");
  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">
        Choose the correct definition
      </h3>

      <p className="text-2xl font-bold mb-4">{word.definition}</p>

      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-full p-3 border rounded-lg mb-4"
        placeholder="Type definition..."
      />

      <div className="flex justify-end">
        <button
          onClick={() => onSubmit(val)}
          className="px-4 py-2 bg-[#4255FF] text-white rounded"
        >
          Submit
        </button>
      </div>
    </div>
  );
}

function MCQuestion({
  word,
  options,
  onChoose,
}: {
  word: Term;
  options: string[];
  onChoose: (choice: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const choose = (o: string) => {
    if (locked) return;
    setSelected(o);
    setLocked(true);
    setTimeout(() => {
      onChoose(o);
      setLocked(false);
      setSelected(null);
    }, 450);
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">
        Choose the correct definition
      </h3>
      <p className="text-2xl font-bold mb-4">{word.term}</p>

      <div className="flex flex-col gap-3">
        {options.map((o, i) => (
          <button
            key={`${o}-${i}`}
            onClick={() => choose(o)}
            className={`p-3 rounded-xl border text-left transition ${
              selected === o ? "bg-gray-200" : "bg-white"
            }`}
            disabled={locked}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
