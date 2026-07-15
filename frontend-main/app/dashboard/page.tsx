"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardTab from "./_components/DashboardTab";
import CommunityTab from "./_components/CommunityTab";

export default function MainPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "dashboard";

  const handleTabChange = (value: string) => {
    router.push(`/dashboard?tab=${value}`);
  };

  return (
    <div className="p-8 min-h-screen mb-10">
      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <div className="flex justify-center mb-2">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="community">Community</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="dashboard" className="w-full max-w-[860px] mx-auto">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="community" className="w-full max-w-[860px] mx-auto">
          <CommunityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
