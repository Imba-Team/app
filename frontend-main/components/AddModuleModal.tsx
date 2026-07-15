"use client";

import { useState } from "react";
import { useCreateModule } from "@/lib/hooks/useModules";
import { useCreateTerm } from "@/lib/hooks/useTerms";
import { toast } from "sonner";

type Word = {
  term: string;
  translation: string;
};

type CreateModule = {
  title: string;
  description: string;
  isPrivate: boolean;
};

type AddModuleModalProps = {
  onAdd: (data: CreateModule | null) => void;
};

export default function AddModuleModal({ onAdd }: AddModuleModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [numWords, setNumWords] = useState(1);
  const [words, setWords] = useState<Word[]>([{ term: "", translation: "" }]);

  const createModule = useCreateModule();
  const createTerm = useCreateTerm();

  const handleNumWordsChange = (value: number) => {
    setNumWords(value);
    const newWords = [...words];
    while (newWords.length < value)
      newWords.push({ term: "", translation: "" });
    while (newWords.length > value) newWords.pop();
    setWords(newWords);
  };

  const handleWordChange = (
    index: number,
    field: "term" | "translation",
    value: string
  ) => {
    const newWords = [...words];
    newWords[index][field] = value;
    setWords(newWords);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Module title is required");
      return;
    }

    createModule.mutate(
      { title: name, description, isPrivate: false },
      {
        onSuccess: async (created) => {
          const moduleId = created.id;
          // Create words sequentially (could be parallelized if API supports)
          for (const word of words) {
            if (!word.term || !word.translation) continue;
            await new Promise<void>((resolve) => {
              createTerm.mutate(
                {
                  moduleId,
                  term: word.term,
                  definition: word.translation,
                  isStarred: false,
                },
                {
                  onSuccess: () => resolve(),
                  onError: () => resolve(), // continue on error but toast is handled in hook
                }
              );
            });
          }

          // reset
          setName("");
          setDescription("");
          setNumWords(1);
          setWords([{ term: "", translation: "" }]);
          onAdd(null);
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <form
        className="bg-white p-6 rounded-xl shadow-xl w-96 max-h-[90vh] overflow-y-auto"
        onSubmit={handleSubmit}
      >
        <h2 className="text-xl font-bold mb-4">Add Module</h2>

        <input
          type="text"
          placeholder="Module Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 border rounded mb-2"
        />
        <input
          type="text"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full p-2 border rounded mb-2"
        />

        {words.map((word, idx) => (
          <div key={idx} className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Word"
              value={word.term}
              onChange={(e) => handleWordChange(idx, "term", e.target.value)}
              className="w-1/2 p-2 border rounded"
            />
            <input
              type="text"
              placeholder="Translation"
              value={word.translation}
              onChange={(e) =>
                handleWordChange(idx, "translation", e.target.value)
              }
              className="w-1/2 p-2 border rounded"
            />
          </div>
        ))}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="submit"
            className="bg-[#4255FF] text-white py-2 px-4 rounded"
          >
            Add Module
          </button>
          <button
            type="button"
            className="border border-gray-300 py-2 px-4 rounded"
            onClick={() => handleNumWordsChange(numWords + 1)}
          >
            Add word
          </button>
          <button
            type="button"
            className="border border-gray-300 py-2 px-4 rounded"
            onClick={() => onAdd(null)}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
