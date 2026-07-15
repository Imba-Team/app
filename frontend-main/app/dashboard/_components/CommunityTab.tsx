"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { CommunityModule as CommunityModuleType } from "@/lib/api";
import { useState } from "react";
import { useCommunityModules } from "@/lib/hooks/useModules";
import { toast } from "sonner";
import { CommunityLoading } from "./CommunitySkeleton";

export default function CommunityTab() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [inputValue, setInputValue] = useState("");

  const {
    data: communityModules = [],
    isLoading,
    isError,
  } = useCommunityModules(searchQuery);

  const handleSearch = () => {
    setSearchQuery(inputValue);
  };

  if (isLoading) {
    return <CommunityLoading />;
  }

  if (isError) {
    toast.error("Failed to load community modules");
  }

  return (
    <main className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
      {/* Header Section */}
      <div className="mb-8 md:mb-12 space-y-3">
        <h2 className="text-2xl md:text-3xl lg:text-4xl text-[#4255FF] font-bold text-center">
          Community Modules
        </h2>
        <p className="text-center text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
          Search and explore modules shared by the Imba Learn community!
        </p>
      </div>

      {/* Search Section */}
      <div className="mb-8 md:mb-10">
        <div
          className="flex flex-col sm:flex-row w-full max-w-2xl mx-auto items-stretch sm:items-center gap-3 sm:gap-2"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSearch();
            }
          }}
        >
          <Input
            type="text"
            placeholder="Search community modules..."
            className="h-11 sm:h-10 flex-1"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <Button
            type="submit"
            variant="default"
            onClick={handleSearch}
            className="h-11 sm:h-10 sm:w-auto w-full"
          >
            Search
          </Button>
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {communityModules.map((m: CommunityModuleType) => (
          <Card
            key={m.id}
            className="flex flex-col hover:shadow-lg transition-shadow duration-200"
          >
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold line-clamp-2 mb-2">
                    {m.title}
                  </h3>
                  <p className="text-muted-foreground text-sm line-clamp-2">
                    {m.description}
                  </p>
                </div>
                <div className="flex items-center">
                  <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs font-medium">
                    {m.termsCount} {m.termsCount === 1 ? "term" : "terms"}
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col justify-between pt-0 space-y-4">
              {/* Owner Info */}
              <div>
                <p className="text-xs text-gray-500 mb-2">Shared by:</p>
                <div className="flex gap-2 items-center">
                  <Avatar className="size-8 border border-gray-100 shrink-0">
                    <AvatarImage
                      src={"https://imba-server.up.railway.app" + m.ownerImg}
                      alt={m.ownerName}
                      crossOrigin="anonymous"
                    />
                    <AvatarFallback className="text-xs">
                      {m.ownerName.charAt(0).toUpperCase() +
                        m.ownerName.charAt(1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-sm font-medium truncate">{m.ownerName}</p>
                </div>
              </div>

              {/* View Button */}
              <Button
                size="sm"
                className="w-full"
                onClick={() => router.push(`/modules/${m.id}`)}
              >
                View Module
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {communityModules.length === 0 && !isLoading && (
        <div className="text-center py-12 md:py-16">
          <p className="text-muted-foreground text-base md:text-lg">
            No community modules found. Try a different search term.
          </p>
        </div>
      )}
    </main>
  );
}
