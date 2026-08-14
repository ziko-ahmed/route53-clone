"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, Button, Field } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already signed in? Skip straight to the console.
  useEffect(() => {
    if (!loading && user) router.replace("/hosted-zones");
  }, [loading, user, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn(email, password);
      toast.success(`Signed in as ${email}`);
      router.replace("/hosted-zones");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-brand">
        <span className="topnav-logo-mark" aria-hidden="true">
          53
        </span>
        <span>Route 53 Console</span>
      </div>

      <form className="login-card" onSubmit={handleSubmit}>
        <h1 style={{ fontSize: 20, marginBottom: 16 }}>Sign in</h1>

        {error && <Alert kind="error">{error}</Alert>}

        <Field label="Email address" htmlFor="email">
          <input
            id="email"
            className="input"
            type="email"
            required
            autoFocus
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field label="Password" htmlFor="password" hint="At least 4 characters.">
          <input
            id="password"
            className="input"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <Button type="submit" variant="primary" block loading={submitting}>
          {submitting ? "Signing in" : "Sign in"}
        </Button>
      </form>

      <p className="login-note">
        Sign-in is mocked for this project. Any email address and any password of four
        characters or more will let you in.
      </p>
    </main>
  );
}
