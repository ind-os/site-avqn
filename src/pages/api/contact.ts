/**
 * Route serveur des formulaires du site.
 *
 * POST /api/contact  (même origine que le site).
 * Body : JSON ou form-urlencoded, un dictionnaire plat de champs. `source` et
 * `email` sont requis ; tout autre champ est accepté tel quel et transmis.
 *
 * Toute la logique (borne de débit, bornes du corps, validation, l'envoi du
 * mail) vit dans `src/lib/contact.ts` — cette route ne fait que brancher l'env
 * runtime et tenir la borne de débit du process. Les sept réglages d'envoi
 * sont lus au runtime par `getSecret` d'astro:env (posés par la définition de
 * l'app).
 */
import type { APIRoute } from "astro";
import { getSecret } from "astro:env/server";
import { creerBorneDeDebit, traiterRequete } from "../../lib/contact";

// Route dynamique : rendue à la demande par le runtime Node (pas prerender).
export const prerender = false;

/** Une borne pour tout le process : le site tourne dans un seul conteneur. */
const debit = creerBorneDeDebit();

export const POST: APIRoute = async ({ request }) => {
  const { status, headers, body } = await traiterRequete(
    request,
    {
      ENVOI_HOTE: getSecret("ENVOI_HOTE"),
      ENVOI_PORT: getSecret("ENVOI_PORT"),
      ENVOI_IDENTIFIANT: getSecret("ENVOI_IDENTIFIANT"),
      ENVOI_MOT_DE_PASSE: getSecret("ENVOI_MOT_DE_PASSE"),
      ENVOI_ADRESSE: getSecret("ENVOI_ADRESSE"),
      ENVOI_NOM: getSecret("ENVOI_NOM"),
      AVQN_DESTINATAIRE: getSecret("AVQN_DESTINATAIRE"),
    },
    debit,
  );

  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
};
