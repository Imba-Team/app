"use client";

import { useEffect } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { X } from "lucide-react";
import { useUpdateMe, User } from "@/lib/hooks/useUser";

const editProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  status: z.string().optional(),
});

type EditProfileValues = z.infer<typeof editProfileSchema>;

interface EditProfileFormProps {
  userData: User;
  onCancel: () => void;
  onSuccess?: () => void;
}

export default function EditProfileForm({
  userData,
  onCancel,
  onSuccess,
}: EditProfileFormProps) {
  const updateMe = useUpdateMe();

  const form = useForm<EditProfileValues>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      name: userData.name ?? "",
      email: userData.email ?? "",
      status: userData.status ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      name: userData.name ?? "",
      email: userData.email ?? "",
      status: userData.status ?? "",
    });
  }, [userData, form]);

  const handleSubmit = (values: EditProfileValues) => {
    updateMe.mutate(values, {
      onSuccess: () => {
        onSuccess?.();
        onCancel();
      },
    });
  };

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardHeader className="bg-linear-to-r from-[#4255ff]/5 to-accent/5 pb-4 -m-6 p-6 mb-0">
        <div className="flex items-center justify-between">
          <div className="ml-6">
            <CardTitle className="text-2xl ">Edit profile</CardTitle>
            <CardDescription>Update your account information</CardDescription>
          </div>
          <button
            onClick={onCancel}
            className="mr-6 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="Your name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="e.g. Student" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={updateMe.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {updateMe.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={updateMe.isPending}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
