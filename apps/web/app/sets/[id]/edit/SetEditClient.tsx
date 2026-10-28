"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft, Globe, Layers, Loader2, Lock, Trash2 } from "lucide-react";

import { LanguageSelect } from "@/components/languageSelect";
import { TagInput } from "@/components/tagInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { Module } from "@/lib/api";
import {
  useDeleteModule,
  useModule,
  useUpdateModule,
} from "@/lib/hooks/useModules";
import { textLimits } from "@/lib/textLimits";
import { cn } from "@/lib/utils";

const setSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the module a title")
    .max(textLimits.setTitle),
  description: z.string().trim().max(textLimits.setDescription),
  language: z.string(),
  tags: z.array(z.string()).max(textLimits.maxTags),
  isPrivate: z.boolean(),
});

type SetFormValues = z.infer<typeof setSchema>;

const toFormValues = (mod: Module): SetFormValues => ({
  title: mod.title,
  description: mod.description ?? "",
  language: mod.language ?? "",
  tags: mod.tags.map((t) => t.name),
  isPrivate: mod.isPrivate,
});

interface Props {
  id: string;
}

export function SetEditClient({ id }: Props) {
  const router = useRouter();
  const { data: envelope, isLoading, isError } = useModule(id);
  const mod = envelope?.data;
  const updateModule = useUpdateModule();
  const deleteModule = useDeleteModule();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = useForm<SetFormValues>({
    resolver: zodResolver(setSchema),
    defaultValues: {
      title: "",
      description: "",
      language: "",
      tags: [],
      isPrivate: false,
    },
  });
  const { reset } = form;

  // Seed the form once the set loads (and if the id changes); `reset`
  // also makes these values the baseline for `isDirty`.
  const loadedId = mod?.id;
  useEffect(() => {
    if (mod) reset(toFormValues(mod));
    // Re-seed only when a different set loads, not on every refetch,
    // so a background refetch can't wipe unsaved edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedId, reset]);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="h-10 w-64 rounded bg-gray-100" />
        <Skeleton className="mt-6 h-64 w-full rounded bg-gray-100" />
      </main>
    );
  }

  if (isError || !mod) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-gray-500">Module not found.</p>
        <Button asChild variant="ghost" className="mt-3">
          <Link href="/library">← Back to library</Link>
        </Button>
      </main>
    );
  }

  if (!mod.canEdit) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="font-semibold text-gray-800">
          You can&apos;t edit this module.
        </p>
        <p className="text-sm text-gray-500">
          Only its owner and editors can change a module&apos;s details.
        </p>
        <Button asChild variant="ghost" className="mt-3">
          <Link href={`/modules/${id}`}>← Back to module</Link>
        </Button>
      </main>
    );
  }

  const isOwner = mod.isOwner;
  const { isDirty } = form.formState;

  const onSubmit = async (values: SetFormValues) => {
    try {
      await updateModule.mutateAsync({
        id,
        data: {
          title: values.title,
          description: values.description,
          language: values.language || null,
          tags: values.tags,
          // Visibility is owner-only on the server.
          ...(isOwner ? { isPrivate: values.isPrivate } : {}),
        },
      });
      router.push(`/modules/${id}`);
    } catch {
      // useUpdateModule already shows the error toast.
    }
  };

  const handleDelete = async () => {
    try {
      await deleteModule.mutateAsync(id);
      router.push("/library");
    } catch {
      // useDeleteModule already shows the error toast.
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <Link
          href={`/modules/${id}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to module
        </Link>
      </div>

      <h1 className="mb-6 text-3xl font-bold text-brand-500">Edit module</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Title <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input maxLength={textLimits.setTitle} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        maxLength={textLimits.setDescription}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="set-language">Language</FormLabel>
                      <LanguageSelect
                        id="set-language"
                        value={field.value}
                        onChange={field.onChange}
                        className="w-full"
                      />
                      <FormDescription>
                        Helps people find it in Discover.
                      </FormDescription>
                    </FormItem>
                  )}
                />

                {isOwner && (
                  <FormField
                    control={form.control}
                    name="isPrivate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel asChild>
                          <span>Visibility</span>
                        </FormLabel>
                        <div
                          role="radiogroup"
                          aria-label="Visibility"
                          className="grid grid-cols-2 gap-2"
                        >
                          <VisibilityOption
                            selected={!field.value}
                            onClick={() => field.onChange(false)}
                            icon={<Globe size={16} />}
                            label="Public"
                            hint="Anyone can find and save it."
                          />
                          <VisibilityOption
                            selected={field.value}
                            onClick={() => field.onChange(true)}
                            icon={<Lock size={16} />}
                            label="Private"
                            hint="Only you can see it."
                          />
                        </div>
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="set-tags">Tags</FormLabel>
                    <TagInput
                      id="set-tags"
                      value={field.value}
                      onChange={field.onChange}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Flashcards</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-600">
                {mod.flashcardsCount ?? 0} card
                {(mod.flashcardsCount ?? 0) === 1 ? "" : "s"}. Edit them on
                the module page.
              </p>
              <Button asChild variant="outline">
                <Link
                  href={`/modules/${id}`}
                  className="inline-flex items-center gap-2"
                >
                  <Layers className="h-4 w-4" /> Manage cards
                </Link>
              </Button>
            </CardContent>
          </Card>

          {isOwner && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg text-red-600">
                  Danger zone
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    Delete module
                  </p>
                  <p className="text-xs text-gray-500">
                    Removes the module and all its cards. Not reversible.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Delete
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push(`/modules/${id}`)}
              disabled={updateModule.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isDirty || updateModule.isPending}
              className="min-w-32"
            >
              {updateModule.isPending ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </form>
      </Form>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this module?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            This removes the module and all its cards from your library. This
            action can&apos;t be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteModule.isPending}
              onClick={handleDelete}
            >
              {deleteModule.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function VisibilityOption({
  selected,
  onClick,
  icon,
  label,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "h-auto flex-col items-start justify-start gap-1 p-3 text-left whitespace-normal",
        selected
          ? "border-brand-500 bg-brand-500/5 text-brand-500 hover:bg-brand-500/5"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-white",
      )}
    >
      <span className="flex items-center gap-2 font-medium">
        {icon}
        {label}
      </span>
      <span className="text-xs font-normal text-gray-500">{hint}</span>
    </Button>
  );
}
