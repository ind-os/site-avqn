/**
 * Dessine une icône Solar en SVG, au moment du build.
 *
 * La charte de l'instance dit d'où viennent les icônes
 * (`apps/styleguide/public/doctrine/icones.md`) : Solar Bold Duotone pour ce
 * qui porte un sens, Solar Linear pour les signes utilitaires. Le site n'en
 * dessine plus aucune lui-même — un trait écrit ici serait un trait qui ne
 * suit pas la charte.
 *
 * Même principe que `apps/styleguide/src/lib/icone-svg.mjs`, réduit au seul
 * jeu dont le site a besoin : une app ne voit pas ses voisines depuis son
 * contexte Docker, il lui faut donc sa propre copie, comme pour les jetons de
 * la charte (`src/styles/charte/`).
 *
 * Le jeu complet n'est lu qu'ici, côté Node : seul le dessin demandé part dans
 * la page, et `@iconify-json/solar` reste une dépendance de développement,
 * élaguée de l'image finale par `pnpm prune --prod`.
 *
 * Solar, par 480 Design, est sous licence CC BY 4.0 : le crédit figure au pied
 * du site (`src/components/Footer.astro`).
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const SOLAR = require("@iconify-json/solar/icons.json");

/**
 * Rend le `<svg>` d'une icône Solar, à poser avec `<Fragment set:html={…} />`.
 * Le dessin porte `stroke="currentColor"` : sa couleur vient de la classe
 * (`text-swiss`, `text-ink`…), sa taille aussi (`h-5 w-5`).
 *
 * @param nom Nom Iconify de l'icône, ex. `alt-arrow-up-linear`.
 * @param classe Classes utilitaires posées sur le `<svg>`.
 */
export function iconeSolar(nom: string, classe = ""): string {
  const icone = SOLAR.icons[nom];
  if (!icone) throw new Error(`Icône Solar inconnue : ${nom}`);
  const largeur = icone.width ?? SOLAR.width ?? 24;
  const hauteur = icone.height ?? SOLAR.height ?? 24;
  return `<svg viewBox="0 0 ${largeur} ${hauteur}" class="${classe}" aria-hidden="true">${icone.body}</svg>`;
}
