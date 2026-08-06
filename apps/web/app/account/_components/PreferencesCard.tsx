"use client";

/**
 * Language + timezone preferences.
 *
 * Both fields are persisted via PATCH /users/me. Language currently
 * only sets <html lang> (via HtmlLangSync); it's stored so future email
 * templates and AI features can honour it. Timezone drives per-user
 * SRS "today" and reminder delivery hour on the backend.
 *
 * On first render for a user with no saved value, we pre-select the
 * browser's zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`)
 * so the user can accept the sensible default with one click.
 */

import { useEffect, useMemo, useState } from "react";
import { Check, Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMe, useUpdateMe } from "@/lib/hooks/useUser";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" },
  { value: "az", label: "Azərbaycanca" },
] as const;

/**
 * Full IANA list is enormous (500+ zones). We surface it as-is behind
 * a searchable native select for now — a combobox with search would be
 * nicer but pulls in cmdk and adds enough surface that it should be a
 * dedicated task. `Intl.supportedValuesOf` is universal in Node 18+
 * and Chrome/Edge/Safari/Firefox modern.
 */
function getBrowserTimeZones(): string[] {
  const anyIntl = Intl as unknown as {
    supportedValuesOf?: (k: string) => string[];
  };
  const zones = anyIntl.supportedValuesOf?.("timeZone") ?? [];
  return zones.length > 0 ? zones : ["UTC"];
}

function detectBrowserTz(): string {
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    );
  } catch {
    return "UTC";
  }
}

export default function PreferencesCard() {
  const { data: me } = useMe();
  const updateMe = useUpdateMe();

  const zones = useMemo(getBrowserTimeZones, []);
  const savedTz = me?.timezone ?? "UTC";
  const savedLang = me?.preferredLanguage ?? "en";

  // Local draft state — only pushed on Save. Pre-fills from the saved
  // value; if the account is still on the UTC default and the browser
  // reports something more specific, suggest it up-front.
  const [tz, setTz] = useState<string>(savedTz);
  const [lang, setLang] = useState<string>(savedLang);
  const [suggestedTz, setSuggestedTz] = useState<string | null>(null);

  useEffect(() => {
    setTz(savedTz);
    setLang(savedLang);
    const browserTz = detectBrowserTz();
    if (savedTz === "UTC" && browserTz !== "UTC" && browserTz !== savedTz) {
      setSuggestedTz(browserTz);
    } else {
      setSuggestedTz(null);
    }
  }, [savedTz, savedLang]);

  const dirty = tz !== savedTz || lang !== savedLang;

  const handleSave = () => {
    updateMe.mutate(
      {
        timezone: tz,
        preferredLanguage: lang as "en" | "ru" | "az",
      },
      {
        onSuccess: () => {
          setSuggestedTz(null);
        },
      },
    );
  };

  const handleUseBrowserTz = () => {
    const detected = detectBrowserTz();
    setTz(detected);
    setSuggestedTz(null);
    if (detected === savedTz) {
      toast.info("Already set to your browser's timezone.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Preferences</CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          Language sets the page language for accessibility. Timezone
          controls what &quot;today&quot; means for your SRS queue and when
          your daily reminder fires.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="pref-language"
              className="text-xs font-medium text-gray-500 flex items-center gap-1.5 mb-1.5"
            >
              <Globe size={12} className="text-gray-400" />
              Preferred language
            </label>
            <Select value={lang} onValueChange={setLang}>
              <SelectTrigger id="pref-language" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400 mt-1">
              The app UI is currently English only; this preference is
              stored for future translations.
            </p>
          </div>

          <div>
            <label
              htmlFor="pref-timezone"
              className="text-xs font-medium text-gray-500 flex items-center gap-1.5 mb-1.5"
            >
              <Globe size={12} className="text-gray-400" />
              Timezone
            </label>
            <Select value={tz} onValueChange={setTz}>
              <SelectTrigger id="pref-timezone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {zones.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={handleUseBrowserTz}
                className="text-brand-500 hover:underline"
              >
                Use my browser&apos;s timezone
              </button>
              <span aria-hidden="true">·</span>
              <span>
                Currently: <span className="font-mono">{detectBrowserTz()}</span>
              </span>
            </div>
          </div>
        </div>

        {suggestedTz && tz === "UTC" && (
          <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800 flex items-start justify-between gap-3">
            <p>
              Your browser says you&apos;re in{" "}
              <span className="font-mono font-semibold">{suggestedTz}</span>.
              Use that instead of UTC?
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleUseBrowserTz}
              className="shrink-0"
            >
              Use {suggestedTz}
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            {dirty ? (
              <span className="text-amber-600">Unsaved changes</span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Check size={12} /> Saved
              </span>
            )}
          </p>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!dirty || updateMe.isPending}
            className="min-w-32"
          >
            {updateMe.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              "Save preferences"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
