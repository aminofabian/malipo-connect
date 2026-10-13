import type { APIRoute } from "astro";
import { setApiMode } from "../../lib/session";

export const prerender = false;

/** Toggle the KioskPay sandbox view. Posts a form, redirects back. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirect("/keys", 303);
  }

  const mode = String(form.get("mode") ?? "") === "test" ? "test" : "live";
  setApiMode(cookies, mode);

  const next = String(form.get("next") ?? "/keys");
  return redirect(next.startsWith("/") ? next : "/keys", 303);
};
