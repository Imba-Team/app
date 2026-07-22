"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, SearchX } from "lucide-react";
import ModuleCard from "@/components/ModuleCard";
import ModuleListItem from "@/components/ModuleListItem";
import CreateModuleCard from "@/components/CreateModuleCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Module as ModuleType } from "@/lib/api";
import {
  useModules,
  useDeleteModule,
  useUpdateModule,
  useUncollectModule,
} from "@/lib/hooks/useModules";
import { toast } from "sonner";
import { DashboardLoading } from "./DashboardSkeleton";
import EmptyDashboard from "./EmptyDashboard";

export default function DashboardTab() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: modules = [], isLoading, isError } = useModules();

  const deleteModule = useDeleteModule();
  const updateModule = useUpdateModule();
  const uncollectModule = useUncollectModule();

  const handleDeleteModule = (module: ModuleType) => {
    if (module.isOwner) {
      deleteModule.mutate(module.id);
      return;
    }
    uncollectModule.mutate(module.id);
  };

  const handleUpdateModule = (
    id: string,
    data: { title: string; description: string; isPrivate: boolean },
  ) => {
    updateModule.mutate({ id, data });
  };

  const handleModuleClick = (m: ModuleType) => {
    router.push(`/modules/${m.id}`);
  };

  if (isLoading) {
    return <DashboardLoading />;
  }

  if (isError) {
    toast.error("Failed to load modules");
  }

  // Zero-modules learner: replace the whole dashboard with a welcome
  // hero + starter CTA. The standard grid layout with a single "+"
  // button was hostile to first-run users.
  if (modules.length === 0) {
    return <EmptyDashboard />;
  }

  const filteredModules = modules.filter((m: ModuleType) =>
    m.title?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const recentModules = modules.slice(0, 4);

  return (
    <main>
      <h2 className="text-2xl text-[#4255FF] font-bold mb-4">Recent Modules</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {recentModules.map((m: ModuleType) => (
          <ModuleCard key={m.id} module={m} onClick={handleModuleClick} />
        ))}
        {/* Fill the row with a Create tile when Recent has fewer than 3
            cards, so the section never looks like a half-empty grid. */}
        {recentModules.length > 0 && recentModules.length < 3 && (
          <CreateModuleCard />
        )}
      </div>

      <div className="mb-2">
        <h2 className="text-2xl text-[#4255FF] font-bold mb-2">All Modules</h2>

        <div className="flex gap-4 mb-4 items-center">
          <Button
            asChild
            variant="outline"
            aria-label="Create new module"
            className="w-15 h-10 rounded-lg flex items-center justify-center hover:scale-105 transition-transform"
          >
            <Link href="/modules/new">
              <Plus size={20} />
            </Link>
          </Button>
          <Input
            type="text"
            placeholder="Search modules..."
            className="h-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col font-semibold text-lg">
        {filteredModules.length === 0 && searchQuery ? (
          <Card className="bg-white">
            <CardContent className="p-8 flex flex-col items-center gap-2 text-center">
              <SearchX className="text-gray-400" size={28} />
              <p className="text-gray-800 font-semibold">
                No modules match &ldquo;{searchQuery}&rdquo;
              </p>
              <p className="text-sm text-gray-500 font-normal">
                Try a different search, or clear the filter.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="mt-2 font-normal"
              >
                Clear search
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredModules.map((m: ModuleType) => (
            <ModuleListItem
              key={m.id}
              module={m}
              onClick={handleModuleClick}
              onDelete={handleDeleteModule}
              onUpdate={handleUpdateModule}
            />
          ))
        )}
      </div>
    </main>
  );
}
