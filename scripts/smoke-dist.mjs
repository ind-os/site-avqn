#!/usr/bin/env node
/**
 * Smoke test du build statique : vérifie que les pages clés existent dans
 * `dist/` et ressemblent à des pages complètes (title + contenu). C'est la
 * garde anti-régression du pipeline (un build Astro peut « réussir » en
 * sortant des pages vides ou en perdant une route au refactor).
 *
 * Usage : node scripts/smoke-dist.mjs   (après `pnpm run build`)
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

// Avec l'adapter @astrojs/node (output static + adapter), les pages prerendues
// atterrissent dans `dist/client/` et le serveur dans `dist/server/`. On garde
// une compatibilité avec l'ancien layout (`dist/` à plat) au cas où.
const distRoot = new URL("../dist", import.meta.url).pathname;
const dist = existsSync(join(distRoot, "client"))
  ? join(distRoot, "client")
  : distRoot;
const errors = [];

function checkPage(path, { contains = [] } = {}) {
  const file = join(dist, path);
  if (!existsSync(file)) {
    errors.push(`page manquante : ${path}`);
    return;
  }
  const html = readFileSync(file, "utf8");
  if (!/<title>[^<]+<\/title>/.test(html)) {
    errors.push(`${path} : pas de <title>`);
  }
  if (html.length < 2000) {
    errors.push(`${path} : suspicieusement courte (${html.length} octets)`);
  }
  for (const marker of contains) {
    if (!html.includes(marker)) {
      errors.push(`${path} : marqueur absent « ${marker} »`);
    }
  }
}

// Les routes piliers du site — en perdre une = régression SEO directe.
// Le positionnement de la home est un marqueur : le perdre au refactor ne
// casserait pas le build, mais changerait ce que le site dit.
checkPage("index.html", {
  contains: ["AVQN", "Automatisez votre business", "avec l'IA"],
});
checkPage("404.html");
checkPage("claude-code-suisse/index.html");
checkPage("coaching-ia-independant-suisse/index.html");
checkPage("formation-ia-entreprise-suisse/index.html");
checkPage("expert-ia-suisse/index.html");
checkPage("bootcamp-ia-suisse/index.html");
checkPage("services/index.html");
checkPage("agents-ia/index.html");
checkPage("n8n-suisse/index.html");
checkPage("n8n-suisse/claude-code-ou-n8n/index.html");
checkPage("consultant-ia-suisse-romande/index.html");
checkPage("ia-pour-independants/index.html");
checkPage("ia-lpd-suisse/index.html");
checkPage("a-propos/index.html");
checkPage("contact/index.html");

for (const asset of ["sitemap-index.xml", "robots.txt", "favicon.svg"]) {
  if (!existsSync(join(dist, asset))) errors.push(`asset manquant : ${asset}`);
}

if (!existsSync(dist) || !statSync(dist).isDirectory()) {
  console.error("dist/ absent — lancer `pnpm run build` d'abord");
  process.exit(1);
}

if (errors.length > 0) {
  console.error(`✗ smoke dist : ${errors.length} problème(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("✓ smoke dist : toutes les pages clés sont là");
