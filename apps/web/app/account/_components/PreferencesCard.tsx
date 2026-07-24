"use client";

/**
 * Preferences placeholder — language + timezone.
 *
 * The TDD (§5.1) specifies `preferredLanguage` and `timezone` columns on
 * User, but they aren't in the current Prisma schema and the
 * `UpdateMyProfileDto` doesn't accept them yet. Both are on the Sprint
 * 1b backlog in CLAUDE.md. This card renders the intended shape as a
 * teaser so the surface exists in the design language now; a follow-up
 * commit will add the columns + wire live controls.
 */

import { Globe, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PreferencesCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xl">Preferences</CardTitle>
        <span className="inline-flex items-center gap-1 text-xs rounded-full border border-gray-200 bg-gray-50 text-gray-500 px-2 py-0.5">
          <Info size={12} /> Coming soon
        </span>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PreferencePreview
            icon={<Globe size={14} className="text-gray-400" />}
            label="Preferred language"
            value="English"
            hint="Used for AI generation defaults and email localisation."
          />
          <PreferencePreview
            icon={<Globe size={14} className="text-gray-400" />}
            label="Timezone"
            value="UTC"
            hint="Determines when SRS reminders fire in your day."
          />
        </div>
        <p className="text-xs text-gray-500">
          Language and timezone will become editable in Sprint 1b — the
          backend columns are on the way. For now these are placeholder
          defaults.
        </p>
      </CardContent>
    </Card>
  );
}

function PreferencePreview({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="border border-dashed border-gray-200 rounded-lg p-3 bg-gray-50/40">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-1">
        {icon}
        {label}
      </div>
      <div className="text-sm text-gray-500">{value}</div>
      <p className="text-xs text-gray-400 mt-1">{hint}</p>
    </div>
  );
}
