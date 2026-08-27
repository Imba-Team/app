"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2, Edit2 } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import type { Module } from "@/lib/api";

type ModuleListItemProps = {
  module: Module;
  onClick: (module: Module) => void;
  onDelete: (module: Module) => void;
};

export default function ModuleListItem({
  module,
  onClick,
  onDelete,
}: ModuleListItemProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <Card className="p-4 mb-4 cursor-pointer transition w-full">
      <div className="flex items-center justify-between">
        <div
          className="cursor-pointer hover:underline"
          onClick={() => onClick(module)}
        >
          {module.title}
        </div>
        <div className="flex items-center gap-4">
          {module.isOwner && (
            <Link
              href={`/sets/${module.id}/edit`}
              onClick={(e) => e.stopPropagation()}
              className="text-gray-500 hover:text-brand-500 hover:scale-110 transition"
              aria-label="Edit module"
              title="Edit module"
            >
              <Edit2 size={20} />
            </Link>
          )}
          <Trash2
            className="text-gray-500 cursor-pointer hover:scale-110 transition"
            size={20}
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(true);
            }}
          />
        </div>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Are you sure you want to delete this module?
            </DialogTitle>
          </DialogHeader>
          <DialogFooter className="justify-end gap-3">
            <Button variant="outline" onClick={() => setConfirming(false)}>
              No
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete(module);
                setConfirming(false);
              }}
            >
              Yes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
