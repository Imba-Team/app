"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ModuleCard from "@/components/ModuleCard";
import ModuleListItem from "@/components/ModuleListItem";
import AddModuleModal from "@/components/AddModuleModal";
import { Button } from "@/components/ui/button";
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

export default function DashboardTab() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Queries
  const { data: modules = [], isLoading, isError } = useModules();

  // Mutations
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
    data: { title: string; description: string; isPrivate: boolean }
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

  const filteredModules = modules.filter((m: ModuleType) =>
    m.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const recentModules = modules.slice(0, 4);

  return (
    <main>
      <h2 className="text-2xl text-[#4255FF] font-bold mb-4">Recent Modules</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {recentModules.map((m: ModuleType) => (
          <ModuleCard key={m.id} module={m} onClick={handleModuleClick} />
        ))}
      </div>

      <div className="mb-2">
        <h2 className="text-2xl text-[#4255FF] font-bold mb-2">All Modules</h2>

        <div className="flex gap-4 mb-4 items-center">
          <Button
            className="w-15 h-10 rounded-lg text-2xl flex items-center justify-center hover:scale-105 transition-transform cursor-pointer"
            variant={"outline"}
            onClick={() => setShowModal(true)}
          >
            +
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
        {filteredModules.map((m: ModuleType) => (
          <ModuleListItem
            key={m.id}
            module={m}
            onClick={handleModuleClick}
            onDelete={handleDeleteModule}
            onUpdate={handleUpdateModule}
          />
        ))}
      </div>

      {showModal && (
        <AddModuleModal
          onAdd={() => {
            setShowModal(false);
          }}
        />
      )}
    </main>
  );
}
