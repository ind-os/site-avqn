/**
 * Table des redirections 301 — SOURCE DE VÉRITÉ UNIQUE.
 *
 * Depuis le passage au runtime Node (adapter @astrojs/node), nginx ne sert
 * plus rien : les 301 sont portées par le catch-all on-demand
 * `src/pages/[...catchall].astro`, qui renvoie de VRAIS 301 (et non des
 * meta-refresh, ce que produirait `redirects` en mode `static`).
 *
 * Règle SEO non négociable : toute route supprimée/renommée a sa 301 ici.
 * Pas de chaîne de redirection : chaque source pointe vers la cible FINALE.
 * Le test unitaire anti-chaîne (`scripts/test-contact.mjs`) garde cette règle :
 * aucune cible ne doit elle-même être redirigée, et chaque cible doit
 * correspondre à une route réelle de `src/pages/`.
 */

/** Redirections exactes (chemin source sans slash final → cible). */
export const EXACT_REDIRECTS: Record<string, string> = {
  // Ancien site (Next.js, i18n /en /fr /pt, « collaboration »)
  "/en": "/",
  "/fr": "/",
  "/pt": "/",
  "/collaboration": "/n8n-suisse",
  "/collaboration/custom-ticketing-system": "/n8n-suisse",
  "/collaboration/whatsapp-ai": "/n8n-suisse",
  "/collaboration/industry-news-feed": "/n8n-suisse",
  "/en/collaboration": "/n8n-suisse",
  "/en/collaboration/custom-ticketing-system": "/n8n-suisse",
  "/en/collaboration/whatsapp-ai": "/n8n-suisse",
  "/en/collaboration/industry-news-feed": "/n8n-suisse",
  "/fr/collaboration": "/n8n-suisse",
  "/fr/collaboration/whatsapp-ai": "/n8n-suisse",
  "/pt/collaboration/podcast-voice-generation": "/n8n-suisse",
  "/audit-offert": "/contact",
  // Unification 2026 : variantes de contact fusionnées en /contact
  "/contact/audit": "/contact",
  "/contact/bootcamp": "/contact",
  "/contact/bootcamp-entreprise": "/contact",
  "/contact/coaching": "/contact",
  "/contact/projet": "/contact",
  // Migration 2026 : slugs longs → routes courtes
  "/services-automatisation-ia-n8n-suisse-romande": "/services",
  "/services-automatisation-ia-n8n-suisse-romande/strategie":
    "/consultant-ia-suisse-romande",
  "/services-automatisation-ia-n8n-suisse-romande/integration": "/agents-ia",
  "/services-automatisation-ia-n8n-suisse-romande/formation":
    "/bootcamp-ia-suisse",
  "/usecases-automatisation-ia-n8n-suisse-romande": "/n8n-suisse",
  "/a-propos/ai-automatisation": "/agents-ia",
  // Anciennes URLs services (site Next.js)
  "/services-automatisation-ia-n8n-suisse-romande/consulting-ia-automatisation-n8n":
    "/consultant-ia-suisse-romande",
  "/services-automatisation-ia-n8n-suisse-romande/integration-workflow-n8n-ia-automatisation":
    "/agents-ia",
  "/services-automatisation-ia-n8n-suisse-romande/formation-ia-automatisation-n8n":
    "/bootcamp-ia-suisse",
  "/services/consulting-ia-automatisation-n8n": "/consultant-ia-suisse-romande",
  "/services/integration-workflow-n8n-ia-automatisation": "/agents-ia",
  "/services/formation-ia-automatisation-n8n": "/bootcamp-ia-suisse",
  "/services/consulting": "/consultant-ia-suisse-romande",
  "/services/strategie-ia-automatisation": "/consultant-ia-suisse-romande",
  "/services/ai-automatisation": "/agents-ia",
  "/services/automatisation": "/agents-ia",
  "/services/prototypage": "/agents-ia",
  "/services/developpement": "/agents-ia",
  "/services/formation/initiation": "/bootcamp-ia-suisse",
  "/services/formation/coaching": "/coaching-ia-independant-suisse",
  "/services/formation/equipe": "/formation-ia-entreprise-suisse",
  "/n8n": "/n8n-suisse",
  // Refonte 2026 : cluster n8n consolidé
  "/n8n/quest-ce-que-n8n": "/n8n-suisse",
  "/n8n/pourquoi-utiliser-n8n": "/n8n-suisse",
  "/n8n/comment-apprendre-n8n": "/n8n-suisse",
  "/n8n/n8n-vs-zapier-make": "/n8n-suisse",
  "/n8n/cas-usage-n8n-pme": "/n8n-suisse",
  "/n8n/heberger-n8n-en-suisse": "/n8n-suisse",
  // Refonte 2026 (repositionnement Claude Code) : les pages services
  // détaillées disparaissent au profit des rubriques thématiques.
  "/services/strategie": "/consultant-ia-suisse-romande",
  "/services/integration": "/agents-ia",
  "/services/formation": "/bootcamp-ia-suisse",
  // Le pilier « construire avec l'IA » et son sous-arbre rejoignent les deux
  // piliers de compétence.
  "/construire-avec-ia": "/claude-code-suisse",
  "/construire-avec-ia/quest-ce-que-claude-code": "/claude-code-suisse",
  "/construire-avec-ia/creer-application-sans-coder": "/claude-code-suisse",
  "/construire-avec-ia/creer-agent-ia": "/agents-ia",
  // Cocon « cas d'usage » supprimé. Le seul cas CLIENT réel (Vetmint, outil
  // sur mesure) part vers /expert-ia-suisse, où le cas est documenté en
  // détail ; tout le reste vers /n8n-suisse, qui absorbe la substance
  // éditoriale des fiches.
  "/cas-usage/reporting/vetmint-dashboard-cliniques-veterinaires":
    "/expert-ia-suisse",
  "/cas-usage": "/n8n-suisse",
  // Refonte 2026 (architecture par audience) : les offres vivent à la racine,
  // nommées par l'audience qui les cherche.
  "/claude-code/coaching": "/coaching-ia-independant-suisse",
  "/claude-code/equipe": "/formation-ia-entreprise-suisse",
  "/n8n-suisse/bootcamp": "/bootcamp-ia-suisse",
  // Le pilier Claude Code est géo-qualifié comme le pilier n8n ; ses deux
  // guides (définition, vibe coding) sont absorbés par le pilier.
  "/claude-code": "/claude-code-suisse",
  "/claude-code/quest-ce-que-claude-code": "/claude-code-suisse",
  "/claude-code/creer-application-sans-coder": "/claude-code-suisse",
  // Le guide « créer un agent IA » est absorbé par son pilier.
  "/agents-ia/creer-agent-ia": "/agents-ia",
};

/**
 * Redirections par préfixe (toute la sous-arborescence → cible). Couvre les
 * `rewrite ^/...(.+)$` de l'ancien nginx pour les chemins arbitraires.
 */
export const PREFIX_REDIRECTS: Array<{ prefix: string; target: string }> = [
  // /services-automatisation-ia-n8n-suisse-romande/* → /services
  // (page unique : un rebase produirait des cibles disparues)
  {
    prefix: "/services-automatisation-ia-n8n-suisse-romande/",
    target: "/services",
  },
  // /usecases-automatisation-ia-n8n-suisse-romande/* → /n8n-suisse
  {
    prefix: "/usecases-automatisation-ia-n8n-suisse-romande/",
    target: "/n8n-suisse",
  },
  // /collaboration/* et /(en|fr|pt)/collaboration/* → /n8n-suisse
  { prefix: "/collaboration/", target: "/n8n-suisse" },
  { prefix: "/en/collaboration/", target: "/n8n-suisse" },
  { prefix: "/fr/collaboration/", target: "/n8n-suisse" },
  { prefix: "/pt/collaboration/", target: "/n8n-suisse" },
  // /n8n/* (cluster consolidé) → /n8n-suisse
  { prefix: "/n8n/", target: "/n8n-suisse" },
  // /cas-usage/* (cocon supprimé : 9 catégories + 27 fiches illustratives)
  { prefix: "/cas-usage/", target: "/n8n-suisse" },
  // /construire-avec-ia/* (filet : les 3 guides ont leur entrée exacte)
  { prefix: "/construire-avec-ia/", target: "/claude-code-suisse" },
  // /claude-code/* (filet : les 4 enfants connus ont leur entrée exacte,
  // résolue avant le préfixe)
  { prefix: "/claude-code/", target: "/claude-code-suisse" },
];

/** Normalise un pathname : retire le slash final (sauf racine). */
function normalize(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

/**
 * Résout la cible 301 d'un chemin, ou `null` si aucune redirection.
 * Préfixe « rebasé » : `/services-…/foo` → `/services/foo` ; les préfixes dont
 * la cible n'a pas de slash final redirigent toute la sous-arbo vers une page
 * unique (ex. `/cas-usage/x` → `/n8n-suisse`).
 */
export function resolveRedirect(pathname: string): string | null {
  const p = normalize(pathname);

  const exact = EXACT_REDIRECTS[p];
  if (exact) return exact;

  for (const { prefix, target } of PREFIX_REDIRECTS) {
    if (p.startsWith(prefix)) {
      if (target.endsWith("/")) {
        const rest = p.slice(prefix.length);
        return normalize(target + rest);
      }
      return target;
    }
  }

  return null;
}
