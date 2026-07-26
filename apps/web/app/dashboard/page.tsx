import { DashboardGreeting } from "./_components/DashboardGreeting";
import DashboardTab from "./_components/DashboardTab";

export default function DashboardPage() {
  return (
    <main className="p-8 min-h-screen mb-10">
      <div className="w-full max-w-[860px] mx-auto">
        <DashboardGreeting />
        <DashboardTab />
      </div>
    </main>
  );
}
