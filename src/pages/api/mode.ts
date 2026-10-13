import type { APIRoute } from "astro";
import { setApiMode } from "../../lib/session";

export const prerender = false;

/** Only allow same-site redirect targets. */
function target(next: string | null): string {
  return next && next.startsWith("/") ? next : "/keys";
}

/** GET form — used by the Live/Test links in the top bar. */
export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const mode = url.searchParams.get("mode") === "test" ? "test" : "live";
  setApiMode(cookies, mode);
  return redirect(target(url.searchParams.get("next")), 303);
};

/** POST form — kept for no-JS progressive enhancement. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirect("/keys", 303);
  }

  const mode = String(form.get("mode") ?? "") === "test" ? "test" : "live";
  setApiMode(cookies, mode);
  return redirect(target(String(form.get("next") ?? "")), 303);
};
