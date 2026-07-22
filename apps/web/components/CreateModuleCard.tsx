"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Placeholder tile for the Recent Modules row. Same footprint as
 * ModuleCard so the grid stays visually balanced when the learner has
 * only 1–2 modules.
 */
export default function CreateModuleCard() {
  return (
    <Link href="/modules/new" className="block">
      <Card className="bg-white p-4 border-dashed border-2 border-gray-300 hover:border-[#4255FF] hover:shadow-md transition-all cursor-pointer h-32 flex items-center justify-center">
        <CardContent className="p-0 text-center">
          <div className="mx-auto mb-2 rounded-full bg-[#4255FF]/10 p-2 w-fit">
            <Plus size={18} className="text-[#4255FF]" />
          </div>
          <p className="font-semibold text-gray-800 text-sm">
            Create new module
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
