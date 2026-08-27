"use client";

import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useCreateModuleDialog } from "@/contexts/CreateModuleDialogContext";

/**
 * Placeholder tile for the Recent Modules row. Same footprint as
 * ModuleCard so the grid stays visually balanced when the learner has
 * only 1–2 modules.
 */
export default function CreateModuleCard() {
  const createModule = useCreateModuleDialog();
  return (
    <button
      type="button"
      onClick={() => createModule.open()}
      className="block w-full text-left"
    >
      <Card className="p-4 cursor-pointer h-32 flex items-center justify-center">
        <CardContent className="p-0 text-center">
          <div className="mx-auto mb-2 rounded-full bg-brand-500/10 p-2 w-fit">
            <Plus size={18} className="text-brand-500" />
          </div>
          <p className="font-semibold text-gray-800 text-sm">
            Create new module
          </p>
        </CardContent>
      </Card>
    </button>
  );
}
