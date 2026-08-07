import { Button } from "@seakim/design-system";
import { signIn } from "@/auth";

export default function Login() {
  async function google() {
    "use server";
    await signIn("google", { redirectTo: "/" });
  }
  return (
    <main
      style={{
        maxWidth: "24rem",
        minHeight: "100vh",
        margin: "0 auto",
        padding: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-6)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ font: "var(--type-title)", color: "var(--text-primary)" }}>
          fantasy-hub
        </h1>
        <p
          style={{
            marginTop: "var(--space-1)",
            font: "var(--type-body-sm)",
            color: "var(--text-secondary)",
          }}
        >
          Sign in
        </p>
      </div>

      <form action={google} style={{ width: "100%" }}>
        <Button type="submit" variant="secondary" fullWidth>
          Sign in with Google
        </Button>
      </form>

      <p
        style={{
          font: "var(--type-caption)",
          color: "var(--text-tertiary)",
          textAlign: "center",
        }}
      >
        Sign in with your Google account. The{" "}
        <a href="/hall_of_records">Hall of Records</a> is public.
      </p>
    </main>
  );
}
