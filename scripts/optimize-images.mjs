#!/usr/bin/env node
/**
 * Redimensionne et convertit les images de public/images en WebP.
 *
 * Largeurs cibles (logique × ~2 pour retina), d’après le layout :
 * - container-custom = max-w-7xl (1280px) ; demi-largeur ≈ 640px → 1280px max
 * - cartes pilier + ServiceGrid (même fichier) → 1280px
 * - hero PageHeader pleine largeur → 1920px
 * - avatar / CTA / témoignages → 192–320px
 *
 * Source : pour chaque entrée, le script prend le premier fichier trouvé parmi
 *   .png, .jpg, .jpeg, .webp (permet de relancer après suppression des masters).
 *
 * Usage :
 *   pnpm run images:optimize
 *   pnpm run images:optimize -- --only temoignage-felix-sandri-ville-de-lausanne-automatisation-ia-n8n-lausanne
 *   pnpm run images:optimize -- --only 'temoignage-*'
 *   pnpm run images:optimize -- --force
 *   pnpm run images:optimize:clean   # supprime la source si ce n’est pas déjà du .webp
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, "..", "public", "images");

const SOURCE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

/** @type {{ base: string; maxWidth: number; note?: string }[]} */
const MANIFEST = [
  {
    base: "a-propos-emmanuel-bernard-automatisation-ia-n8n-lausanne-suisse-romande-hero",
    maxWidth: 1920,
    note: "Hero PageHeader pleine largeur (viewport)",
  },
  {
    base: "conseil-strategie-automatisation-ia-n8n-lausanne-suisse-romande-carte",
    maxWidth: 1280,
    note: "Cartes pilier 3 cols + ServiceGrid demi-container (max-w-7xl / 2 × retina)",
  },
  {
    base: "conseil-strategie-automatisation-ia-n8n-lausanne-suisse-romande-page",
    maxWidth: 1280,
    note: "Colonne 50 % page stratégie (md:grid-cols-2)",
  },
  {
    base: "integration-workflows-automatisation-ia-n8n-lausanne-suisse-romande-carte",
    maxWidth: 1280,
    note: "Carte pilier + ServiceGrid",
  },
  {
    base: "integration-automatisation-ia-n8n-lausanne-suisse-romande-page",
    maxWidth: 1280,
    note: "Colonne 50 % page intégration + pages contact (même visuel)",
  },
  {
    base: "formation-automatisation-ia-n8n-lausanne-suisse-romande-carte",
    maxWidth: 1280,
    note: "Carte pilier + ServiceGrid",
  },
  {
    base: "formation-automatisation-ia-n8n-lausanne-suisse-romande-page",
    maxWidth: 1280,
    note: "Colonne 50 % page formation",
  },
  {
    base: "formation-automatisation-ia-n8n-lausanne-suisse-romande-fond",
    maxWidth: 1920,
    note: "Fond de section pleine largeur",
  },
  {
    base: "contact-bootcamp-automatisation-ia-n8n-lausanne-suisse-romande",
    maxWidth: 1280,
    note: "Colonne 50 % layout contact",
  },
  {
    base: "contact-bootcamp-entreprise-automatisation-ia-n8n-lausanne-suisse-romande",
    maxWidth: 1280,
    note: "Colonne 50 % layout contact",
  },
  {
    base: "contact-coaching-automatisation-ia-n8n-lausanne-suisse-romande",
    maxWidth: 1280,
    note: "Colonne 50 % layout contact",
  },
  {
    base: "cta-global-potentiel-equipes-automatisation-ia-n8n-lausanne-suisse-romande",
    maxWidth: 320,
    note: "CTA w-32 md:w-40 (~128–160px) × retina",
  },
  {
    base: "emmanuel-bernard-expert-automatisation-ia-n8n-lausanne-suisse-romande-avatar",
    maxWidth: 256,
    note: "Avatar Hero w-24 h-24 × retina",
  },
  {
    base: "emmanuel-bernard-consultant-ia-automatisation-lausanne-suisse-romande-portrait",
    maxWidth: 1100,
    note: "Colonne portrait ~5/12 du container × retina",
  },
  {
    base: "temoignage-serge-reymond-vetcoop-automatisation-ia-n8n-lausanne",
    maxWidth: 192,
    note: "Avatar liste témoignages w-12 h-12 × retina",
  },
  {
    base: "temoignage-sebastian-haag-liip-automatisation-ia-n8n-lausanne",
    maxWidth: 192,
    note: "Avatar liste témoignages",
  },
  {
    base: "temoignage-emilien-coutard-formation-n8n-lausanne-suisse-romande",
    maxWidth: 192,
    note: "Avatar liste témoignages",
  },
  {
    base: "temoignage-olivier-dommange-emploi-lausanne-automatisation-ia-n8n-lausanne",
    maxWidth: 192,
    note: "Avatar liste témoignages",
  },
  {
    base: "temoignage-antoine-aigroz-ville-de-lausanne-automatisation-ia-n8n-lausanne",
    maxWidth: 192,
    note: "Avatar liste témoignages",
  },
  {
    base: "temoignage-felix-sandri-ville-de-lausanne-automatisation-ia-n8n-lausanne",
    maxWidth: 192,
    note: "Avatar liste témoignages",
  },
];

const WEBP_OPTIONS = {
  quality: 82,
  effort: 6,
  smartSubsample: true,
};

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} ko`;
}

/**
 * @param {string} argv
 */
function parseOnlyPatterns(argv) {
  /** @type {string[]} */
  const patterns = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--only" && argv[i + 1] && !argv[i + 1].startsWith("-")) {
      patterns.push(
        ...argv[++i]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
      continue;
    }
    if (a.startsWith("--only=")) {
      patterns.push(
        ...a
          .slice("--only=".length)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }
  }
  return patterns;
}

/**
 * @param {string} argv
 */
function parseArgs(argv) {
  const deleteSources = argv.includes("--delete-sources");
  const force = argv.includes("--force");
  const noSkip = argv.includes("--no-skip-unchanged");
  const list = argv.includes("--list");
  const help = argv.includes("--help") || argv.includes("-h");
  const only = parseOnlyPatterns(argv);
  const skipUnchanged = !noSkip && !force;
  return {
    deleteSources,
    force,
    skipUnchanged,
    list,
    help,
    only,
  };
}

/**
 * @param {string} base
 * @param {string[]} patterns
 */
function baseMatchesOnly(base, patterns) {
  if (patterns.length === 0) return true;
  return patterns.some((pat) => {
    const trimmed = pat.trim();
    if (!trimmed) return false;
    if (!trimmed.includes("*")) return base === trimmed;
    const re = new RegExp(
      "^" +
        trimmed.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") +
        "$",
    );
    return re.test(base);
  });
}

function printHelp() {
  console.log(`
optimize-images.mjs — WebP depuis public/images (voir MANIFEST dans ce fichier).

Usage :
  pnpm run images:optimize
  pnpm run images:optimize -- --only <base-ou-glob>[,...]
  pnpm run images:optimize -- --only 'temoignage-*'
  pnpm run images:optimize -- --force
  pnpm run images:optimize -- --list
  pnpm run images:optimize:clean

Options :
  --only <patterns>   Filtre par nom de base exact ou glob (*). Liste séparée par virgules.
  --force             Régénère même si le .webp semble à jour (mtime).
  --no-skip-unchanged Désactive le saut quand source inchangée (défaut : saut actif sauf si --force).
  --list              Affiche les bases du manifeste et quitte.
  --delete-sources    Avec images:optimize:clean : supprime PNG/JPG sources après conversion.

CDN : pnpm run images:sync-cdn (AWS CLI, variables S3_*).
URL site : https://cdn.avqn.ch/images/<fichier>.webp
`);
}

/**
 * @param {string} baseName
 * @returns {Promise<{ path: string; ext: string; fileName: string }>}
 */
async function resolveSource(baseName) {
  for (const ext of SOURCE_EXTENSIONS) {
    const p = path.join(IMAGES_DIR, baseName + ext);
    try {
      await fs.access(p);
      return { path: p, ext, fileName: baseName + ext };
    } catch {
      /* essai suivant */
    }
  }
  throw new Error(
    `Aucune source pour « ${baseName} » (${SOURCE_EXTENSIONS.join(", ")})`,
  );
}

/**
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {boolean} skipUnchanged
 * @returns {Promise<boolean>} true = skip optimization
 */
async function shouldSkipUnchanged(inputPath, outputPath, skipUnchanged) {
  if (!skipUnchanged) return false;
  try {
    const [inStat, outStat] = await Promise.all([
      fs.stat(inputPath),
      fs.stat(outputPath),
    ]);
    return outStat.mtimeMs >= inStat.mtimeMs;
  } catch {
    return false;
  }
}

/**
 * @param {{ base: string; maxWidth: number; note?: string }} entry
 * @param {{ skipUnchanged: boolean }} opts
 * @returns {Promise<{ skipped?: boolean; sourceFile?: string; sourceExt?: string; output?: string; maxWidth?: number; inBytes?: number; outBytes?: number; ratio?: string; note?: string; inputPath?: string }>}
 */
async function optimizeOne(entry, opts) {
  const source = await resolveSource(entry.base);
  const inputPath = source.path;
  const outputPath = path.join(IMAGES_DIR, `${entry.base}.webp`);

  if (await shouldSkipUnchanged(inputPath, outputPath, opts.skipUnchanged)) {
    return { skipped: true, output: `${entry.base}.webp`, note: entry.note };
  }

  const sameInOut = path.resolve(inputPath) === path.resolve(outputPath);

  const meta = await sharp(inputPath).metadata();
  let pipeline = sharp(inputPath).rotate();

  if (meta.width && meta.width > entry.maxWidth) {
    pipeline = pipeline.resize(entry.maxWidth, null, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  if (sameInOut) {
    const tmp = path.join(IMAGES_DIR, `${entry.base}.webp.__writing__`);
    await pipeline.webp(WEBP_OPTIONS).toFile(tmp);
    await fs.rename(tmp, outputPath);
  } else {
    await pipeline.webp(WEBP_OPTIONS).toFile(outputPath);
  }

  const inStat = await fs.stat(inputPath);
  const outStat = await fs.stat(outputPath);
  const ratio = ((1 - outStat.size / inStat.size) * 100).toFixed(1);

  return {
    sourceFile: source.fileName,
    sourceExt: source.ext,
    output: `${entry.base}.webp`,
    maxWidth: entry.maxWidth,
    inBytes: inStat.size,
    outBytes: outStat.size,
    ratio,
    note: entry.note,
    inputPath,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const { deleteSources, force, skipUnchanged, list, help, only } =
    parseArgs(argv);

  if (help) {
    printHelp();
    return;
  }

  if (list) {
    console.log("Bases du manifeste (scripts/optimize-images.mjs) :\n");
    for (const e of MANIFEST) {
      console.log(`  ${e.base}  (max ${e.maxWidth}px)`);
    }
    console.log(`\nTotal : ${MANIFEST.length} entrées.`);
    return;
  }

  const selected = MANIFEST.filter((e) => baseMatchesOnly(e.base, only));
  if (only.length > 0 && selected.length === 0) {
    console.error(
      "Aucune entrée du manifeste ne correspond à --only. Utilisez --list pour les noms.",
    );
    process.exit(1);
  }

  console.log(`Dossier : ${IMAGES_DIR}`);
  if (only.length > 0) {
    console.log(`Filtre : ${only.join(", ")} (${selected.length} entrée(s))`);
  }
  if (skipUnchanged && !force) {
    console.log(
      "Mode : ignorer les sorties déjà à jour (mtime). --force pour tout regénérer.\n",
    );
  } else {
    console.log("");
  }

  let skippedCount = 0;
  for (const entry of selected) {
    const r = await optimizeOne(entry, {
      skipUnchanged: skipUnchanged && !force,
    });
    if (r.skipped) {
      skippedCount++;
      console.log(`○ ${r.output} (inchangé, ignoré)`);
      if (r.note) console.log(`  └ ${r.note}`);
      continue;
    }
    console.log(
      `✓ ${r.sourceFile} → ${r.output} (${formatKb(r.inBytes)} → ${formatKb(r.outBytes)}, ${r.ratio}% vs source)`,
    );
    if (r.note) console.log(`  └ ${r.note}`);

    if (deleteSources && r.sourceExt !== ".webp") {
      await fs.unlink(r.inputPath);
      console.log(`  (source ${r.sourceExt} supprimée)`);
    }
  }

  if (skippedCount > 0) {
    console.log(`\n${skippedCount} fichier(s) ignoré(s) (déjà à jour).`);
  }

  if (!deleteSources) {
    console.log(
      "\nPour supprimer les PNG/JPG après coup : pnpm run images:optimize:clean",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
