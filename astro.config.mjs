// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";

import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  // Le site est majoritairement statique (pages prerendues), servi par un
  // runtime Node (adapter standalone) : les routes serveur (`prerender:false`)
  // tournent à la demande — l'API du formulaire de contact (`/api/contact`),
  // la sonde (`/healthz.json`) et le catch-all de redirections
  // (`[...catchall]`, qui renvoie de VRAIS 301).
  output: "static",
  adapter: node({ mode: "standalone" }),
  // Forme canonique d'une URL : SANS slash final. C'est la forme dans laquelle
  // sont écrits tous les liens internes du site et toute la table
  // `src/lib/redirects.ts` (sources ET cibles). Conséquence : `/services/`
  // renvoie un 301 vers `/services`, et une redirection de la table atteint sa
  // cible en UN seul saut. Avec `"always"`, chacune des redirections héritées
  // gagnerait un saut de normalisation (`/cas-usage` → `/cas-usage/` →
  // `/n8n-suisse` → `/n8n-suisse/`) — exactement la chaîne que la règle n°1 du
  // CLAUDE.md interdit — et un chemin inexistant renverrait 301 avant 404.
  trailingSlash: "never",
  devToolbar: {
    enabled: false,
  },
  site: "https://www.avqn.ch",
  // Les redirections 301 sont portées par le catch-all on-demand
  // `src/pages/[...catchall].astro` (vrais 301), dont la table de vérité est
  // `src/lib/redirects.ts`, et pas par `redirects`, qui en mode `static`
  // produit des pages meta-refresh, un soft redirect insuffisant pour le SEO.
  integrations: [react(), sitemap()],

  vite: {
    plugins: [tailwindcss()],
  },
});
