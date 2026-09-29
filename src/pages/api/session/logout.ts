import type { APIRoute } from "astro";
import { clearConnectSession } from "../../../lib/session";

export const prerender = false;

export const GET: APIRoute = async ({ cookies, redirect }) => {
  clearConnectSession(cookies);
  return redirect("/signin");
};
