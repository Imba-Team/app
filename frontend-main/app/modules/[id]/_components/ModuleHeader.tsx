"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// import { Button } from "@/components/ui/button";
// import { RotateCcw } from "lucide-react";
import type { ModuleInfo } from "../types";

type ModuleHeaderProps = {
  module: ModuleInfo;
  // onResetProgress?: () => void;
  // isCollected?: boolean;
};

export default function ModuleHeader({
  module,
}: // onResetProgress,
// isCollected,
ModuleHeaderProps) {
  return (
    <div>
      <div className="rounded-2xl flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-4xl font-bold text-[#4255FF]">
              {module.title}
            </h1>
            {/* {isCollected &&
              module.progress &&
              module.termsCount > 0 &&
              onResetProgress && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onResetProgress}
                  className="flex items-center gap-2"
                >
                  <RotateCcw size={16} />
                  Reset Progress
                </Button>
              )} */}
          </div>
          <p className="my-4 text-gray-600">{module.description}</p>
          <div>
            <span className="bg-gray-200 text-gray-500 p-1 px-3 text-sm rounded-full">
              {module.termsCount} terms
            </span>
            <span className="bg-gray-200 text-gray-500 p-1 px-3 text-sm rounded-full ml-2">
              {module.isPrivate ? "Private module" : "Public module"}
            </span>

            {module.termsCount !== 0 && module.progress && (
              <span className="bg-gray-200 text-gray-500 p-1 px-3 text-sm rounded-full ml-2">
                {module.progress.completed * 100}
                {"% "}
                completed
              </span>
            )}
          </div>
        </div>

        <div>
          <p className="text-sm text-gray-500 mb-1">Created by:</p>
          <div className="flex gap-x-2 items-center">
            <Avatar className="size-10">
              <AvatarImage
                src={"https://imba-server.up.railway.app" + module.ownerImg}
                alt={module.ownerName}
                crossOrigin="anonymous"
              />
              <AvatarFallback>{module?.ownerName?.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <p>{module.ownerName}</p>
          </div>
        </div>
      </div>

      {module.progress && (
        <div className="mt-4">
          <div className="flex gap-4 text-sm mb-2">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-gray-300"></div>
              <span className="text-gray-600">
                Not Started: {Math.round(module.progress.not_started * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <span className="text-gray-600">
                In Progress: {Math.round(module.progress.in_progress * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-600">
                Completed: {Math.round(module.progress.completed * 100)}%
              </span>
            </div>
          </div>

          <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden flex">
            {module.progress.not_started > 0 && (
              <div
                className="bg-gray-300 h-full"
                style={{ width: `${module.progress.not_started * 100}%` }}
              ></div>
            )}
            {module.progress.in_progress > 0 && (
              <div
                className="bg-yellow-400 h-full"
                style={{ width: `${module.progress.in_progress * 100}%` }}
              ></div>
            )}
            {module.progress.completed > 0 && (
              <div
                className="bg-green-500 h-full"
                style={{ width: `${module.progress.completed * 100}%` }}
              ></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
