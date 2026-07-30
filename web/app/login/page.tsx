import { signIn } from "@/auth";

export default function Login() {
  async function google() {
    "use server";
    await signIn("google", { redirectTo: "/" });
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">fantasy-hub</h1>
        <p className="mt-1 text-sm text-neutral-500">Admin sign in</p>
      </div>
      <form action={google} className="w-full">
        <button className="w-full rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
          Sign in with Google
        </button>
      </form>
      <p className="text-xs text-neutral-400">
        Only the league admin can sign in. The{" "}
        <a href="/hall_of_records" className="underline hover:text-neutral-600">
          Hall of Records
        </a>{" "}
        is public.
      </p>
    </main>
  );
}
