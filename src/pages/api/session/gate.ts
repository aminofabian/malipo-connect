import type { APIRoute } from "astro";

export const prerender = false;

/** Legacy path — Connect uses its own /signin now. */
export const GET: APIRoute = async ({ request, redirect }) => {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return redirect(`/signin?next=${encodeURIComponent(safeNext)}`);
};
