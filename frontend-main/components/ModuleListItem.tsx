"use client";

import { useState } from "react";
import { Trash2, Edit2 } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type Module = {
  id: string;
  slug: string;
  title: string;
  description: string;
  isPrivate: boolean;
  userId: string;
  isOwner: boolean;
};

type ModuleListItemProps = {
  module: Module;
  onClick: (module: Module) => void;
  onDelete: (module: Module) => void;
  onUpdate: (
    id: string,
    data: { title: string; description: string; isPrivate: boolean }
  ) => void;
};

export default function ModuleListItem({
  module,
  onClick,
  onDelete,
  onUpdate,
}: ModuleListItemProps) {
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: module.title,
    description: module.description,
    isPrivate: module.isPrivate,
  });

  return (
    <Card className=" bg-white p-4 mb-4 hover:shadow-md cursor-pointer transition w-full">
      <div className="flex items-center justify-between">
        <div
          className="cursor-pointer hover:underline"
          onClick={() => onClick(module)}
        >
          {module.title}
        </div>
        <div className="flex items-center gap-4">
          {module.isOwner && (
            <div className="">
              <Edit2
                className="text-gray-500 cursor-pointer hover:scale-110 transition"
                size={20}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                }}
              />
            </div>
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

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Module</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 selection:bg-blue-200">
            <Input
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring "
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
            <label className="flex items-center gap-2 text-sm">
              <Input
                type="checkbox"
                className="h-4 w-4"
                checked={form.isPrivate}
                onChange={(e) =>
                  setForm({ ...form, isPrivate: e.target.checked })
                }
              />
              Private
            </label>
          </div>

          <DialogFooter className="justify-end gap-3">
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onUpdate(module.id, form);
                setEditing(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
