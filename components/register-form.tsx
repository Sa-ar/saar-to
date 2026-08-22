"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { formatFormError } from "@/lib/validations/url";
import { registerSchema } from "@/lib/validations/auth";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function RegisterForm({ invite }: { invite: string }) {
  const router = useRouter();
  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      invite,
    },
    validators: {
      onSubmit: registerSchema,
    },
    onSubmit: async ({ value }) => {
      const parsed = registerSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }

      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        toast.error(data.error ?? "Could not create account");
        return;
      }

      const result = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });

      if (!result || result.error) {
        toast.success("Account created. Please sign in.");
        router.push("/login");
        return;
      }

      toast.success("Account created");
      router.push("/");
      router.refresh();
    },
  });

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">saar.to</p>
        <CardTitle className="font-heading text-3xl">Create account</CardTitle>
        <CardDescription>You were invited to manage your own saar.to links.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.Field name="name">
            {(field) => (
              <FormField
                label="Name"
                htmlFor={field.name}
                error={
                  field.state.meta.errors[0]
                    ? formatFormError(field.state.meta.errors[0])
                    : undefined
                }
              >
                <Input
                  id={field.name}
                  name={field.name}
                  autoComplete="name"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
              </FormField>
            )}
          </form.Field>
          <form.Field name="email">
            {(field) => (
              <FormField
                label="Email"
                htmlFor={field.name}
                error={
                  field.state.meta.errors[0]
                    ? formatFormError(field.state.meta.errors[0])
                    : undefined
                }
              >
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  autoComplete="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
              </FormField>
            )}
          </form.Field>
          <form.Field name="password">
            {(field) => (
              <FormField
                label="Password"
                htmlFor={field.name}
                hint="At least 8 characters"
                error={
                  field.state.meta.errors[0]
                    ? formatFormError(field.state.meta.errors[0])
                    : undefined
                }
              >
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  autoComplete="new-password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
              </FormField>
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button
                type="submit"
                className="h-10 w-full rounded-full shadow-[0_0_24px_rgb(249_208_38/0.25)]"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating account…" : "Create account"}
              </Button>
            )}
          </form.Subscribe>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
