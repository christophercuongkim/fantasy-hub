const API_URL = process.env.API_URL ?? "http://localhost:4001";

async function getApiStatus(): Promise<string> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
    if (!res.ok) return `unreachable (HTTP ${res.status})`;
    const body = (await res.json()) as { status?: string };
    return body.status ?? "unknown";
  } catch {
    return "unreachable";
  }
}

export default async function Home() {
  const apiStatus = await getApiStatus();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">fantasy-hub</h1>
      <p className="text-neutral-500">Personal NFL fantasy analytics — skeleton.</p>
      <p className="text-sm">
        API status: <span className="font-mono">{apiStatus}</span>
      </p>
    </main>
  );
}
