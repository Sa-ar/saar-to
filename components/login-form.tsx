"use client";

import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { formatFormError } from "@/lib/validations/url";
import { loginSchema } from "@/lib/validations/auth";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: loginSchema,
    },
    onSubmit: async ({ value }) => {
      const parsed = loginSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }

      const result = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });

      if (!result || result.error) {
        toast.error("Invalid email or password");
        return;
      }

      toast.success("Signed in");
      router.push("/");
      router.refresh();
    },
  });

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">saar.to</p>
        <CardTitle className="font-heading text-3xl">Sign in</CardTitle>
        <CardDescription>Use your email and password to manage saar.to links.</CardDescription>
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
                  autoComplete="current-password"
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
                {isSubmitting ? "Signing in…" : "Sign in"}
              </Button>
            )}
          </form.Subscribe>
          <p className="text-center text-sm text-muted-foreground">
            Accounts are invite-only. Ask the owner for a link.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
