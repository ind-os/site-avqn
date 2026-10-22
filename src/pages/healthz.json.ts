/**
 * Sonde de déploiement {ok, sha} — servie par le runtime Node (plus nginx).
 *
 * Le sha vient de l'env runtime `GIT_SHA`, injecté dans l'image au build
 * (Dockerfile : ARG GIT_SHA → ENV GIT_SHA), lu par `getSecret` d'astro:env.
 */
import type { APIRoute } from "astro";
import { getSecret } from "astro:env/server";

export const prerender = false;

export const GET: APIRoute = () => {
  const sha = getSecret("GIT_SHA") ?? "";
  return new Response(JSON.stringify({ ok: true, sha }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
};
