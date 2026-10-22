# Le site d'AVQN : `docker build .` depuis la racine du dépôt, sans argument ni
# secret au build.
#
# Image finale : un runtime Node (adapter @astrojs/node standalone, port 4321),
# pas nginx — les routes serveur du site (formulaire de contact, sonde de santé,
# redirections 301) tournent à la demande.
FROM node:22.23.4-alpine3.24@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS builder

# pnpm épinglé par le champ `packageManager` de package.json (corepack).
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Gate : typecheck Astro, ESLint, Prettier, test unitaire du formulaire, avant
# le build. Rouge ⇒ pas d'image.
RUN pnpm run check:all && pnpm run test:unit

# Build Astro (contenu 100 % local : aucun secret requis au build).
RUN pnpm run build

# Smoke test du build : pages clés présentes, sinon l'image ne sort pas.
RUN node scripts/smoke-dist.mjs

# Élaguer les dépendances de dev pour l'image finale (runtime only).
RUN pnpm prune --prod

# Stage de production : runtime Node (sert dist/server/entry.mjs).
FROM node:22.23.4-alpine3.24@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS runtime

# curl pour le healthcheck.
RUN apk add --no-cache curl

WORKDIR /app
ENV NODE_ENV=production

# L'adapter standalone écoute sur 0.0.0.0:4321 par défaut.
ENV HOST=0.0.0.0
ENV PORT=4321

# Sonde de santé : /healthz.json renvoie {ok, sha}. Sans GIT_SHA au build, la
# sonde répond avec un sha vide, ce qui suffit à la sonde.
ARG GIT_SHA
ENV GIT_SHA=${GIT_SHA}

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4321/healthz.json || exit 1

CMD ["node", "./dist/server/entry.mjs"]
