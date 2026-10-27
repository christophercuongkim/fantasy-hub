import { Button, GateLayout } from "@seakim/design-system";
import { signIn } from "@/auth";

export default function Login() {
  async function google() {
    "use server";
    await signIn("google", { redirectTo: "/hall_of_records" });
  }

  return (
    <GateLayout brand="fantasy-hub" footer="Sign in with your Google account.">
      <h1
        style={{
          font: "var(--type-title)",
          color: "var(--text-primary)",
          margin: 0,
        }}
      >
        Sign in
      </h1>
      <p
        style={{
          margin: 0,
          font: "var(--type-body-sm)",
          color: "var(--text-secondary)",
        }}
      >
        Personal NFL fantasy analytics.
      </p>
      <form action={google}>
        <Button type="submit" variant="secondary" fullWidth>
          Sign in with Google
        </Button>
      </form>
    </GateLayout>
  );
}
