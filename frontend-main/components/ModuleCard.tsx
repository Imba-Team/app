import React from "react";
import { Card } from "./ui/card";
type Module = {
  id: string;
  slug: string;
  title: string;
  description: string;
  isPrivate: boolean;
  userId: string;
  isOwner: boolean;
};

type ModuleCardProps = {
  module: Module;
  onClick: (module: Module) => void;
};

export default function ModuleCard({ module, onClick }: ModuleCardProps) {
  return (
    <Card
      className="bg-white p-4 hover:shadow-md cursor-pointer transition h-32 w-full"
      onClick={() => onClick(module)}
    >
      <h3 className="font-bold text-lg">{module.title}</h3>
      <p className="text-gray-500 text-sm">{module.description}</p>
    </Card>
  );
}

export type { Module };
