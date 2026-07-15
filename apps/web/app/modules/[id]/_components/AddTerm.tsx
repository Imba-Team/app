"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AddTermProps {
  onSubmit: (term: string, definition: string) => void;
}

export default function AddTerm({ onSubmit }: AddTermProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTerm, setNewTerm] = useState("");
  const [newDef, setNewDef] = useState("");

  const handleSubmit = () => {
    if (!newTerm.trim() || !newDef.trim()) return;

    onSubmit(newTerm, newDef);
    setNewTerm("");
    setNewDef("");
    setIsAdding(false);
  };

  if (isAdding) {
    return (
      <div className="bg-white rounded-2xl shadow-md w-full p-4 mt-4 flex gap-4 items-center">
        <Input
          placeholder="Term"
          className="p-2 rounded-lg flex-1"
          value={newTerm}
          onChange={(e) => setNewTerm(e.target.value)}
        />
        <Input
          placeholder="Definition"
          className="p-2 rounded-lg flex-1"
          value={newDef}
          onChange={(e) => setNewDef(e.target.value)}
        />

        <Button
          onClick={handleSubmit}
          className="px-6 py-2 bg-green-500 text-white rounded-xl text-sm"
        >
          Submit
        </Button>
      </div>
    );
  }

  return (
    <Card
      className="rounded-2xl h-16 w-full mt-4 flex justify-center items-center font-semibold cursor-pointer"
      onClick={() => setIsAdding(true)}
    >
      Add New Term
    </Card>
  );
}
