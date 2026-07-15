"use client";

import { useState } from "react";
import { Star, Edit2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface TermItemProps {
  term: {
    id: string;
    term: string;
    definition: string;
    status?: string;
    isStarred: boolean;
  };
  onDelete: () => void;
  onToggleStar: () => void;
  onSaveEdit: (termId: string, term: string, definition: string) => void;
  isOwned: boolean;
  isCollected: boolean;
}

export default function TermItem({
  term,
  onDelete,
  onToggleStar,
  onSaveEdit,
  isOwned,
  isCollected,
}: TermItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTermValue, setEditTermValue] = useState(term.term);
  const [editDefValue, setEditDefValue] = useState(term.definition);

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    onSaveEdit(term.id, editTermValue, editDefValue);
    setIsEditing(false);
  };
  return (
    <Card className="bg-white rounded-2xl h-16 w-full flex p-4 items-center flex-row">
      <div
        className={`size-4 rounded-full ${
          term.status === "completed"
            ? "bg-green-100 text-green-800"
            : term.status === "in_progress"
            ? "bg-yellow-100 text-yellow-800"
            : "bg-gray-100 text-gray-800"
        }`}
      ></div>

      <div className="flex-1 ml-4">
        {isEditing ? (
          <div className="flex gap-4 items-center">
            <input
              className="p-2  rounded-lg flex-1"
              value={editTermValue}
              onChange={(e) => setEditTermValue(e.target.value)}
            />
            <input
              className="p-2  rounded-lg flex-1"
              value={editDefValue}
              onChange={(e) => setEditDefValue(e.target.value)}
            />

            <button
              onClick={handleSaveEdit}
              className="px-5 py-2 bg-blue-500 text-white rounded-xl text-sm"
            >
              Save
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <div className="font-semibold text-lg">{term.term}</div>
              <div className="w-1 bg-gray-300 rounded-full"></div>
              <div className="font-semibold text-lg">
                {term.definition.slice(0, 40)}
                {term.definition.length > 30 ? "..." : ""}
              </div>
            </div>

            <div className="flex items-center gap-x-2">
              {isOwned && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size={"icon"}>
                      <Edit2 className="text-gray-500 cursor-pointer hover:scale-110 transition size-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Edit Term</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleStartEditing}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={onDelete}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {isCollected && (
                <Button onClick={onToggleStar} variant="ghost" size={"icon"}>
                  <Star
                    className={cn(
                      "text-gray-300 size-5 cursor-pointer hover:scale-110 transition",
                      term.isStarred && "text-yellow-400"
                    )}
                    fill="currentColor"
                  />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
