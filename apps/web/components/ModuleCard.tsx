import React from "react";
import { Card } from "./ui/card";
import type { Module } from "@/lib/api";

type ModuleCardProps = {
  module: Module;
  onClick: (module: Module) => void;
};

export default function ModuleCard({ module, onClick }: ModuleCardProps) {
  return (
    <Card
      className="p-4 cursor-pointer transition h-32 w-full"
      onClick={() => onClick(module)}
    >
      <h3 className="font-bold text-lg">{module.title}</h3>
      <p className="text-gray-500 text-sm">{module.description}</p>
    </Card>
  );
}

export type { Module };
