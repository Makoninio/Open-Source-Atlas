export const continentMeta = {
  "Viral Tools": {
    color: "#d98c4e",
    tagline: "Fast to ship, fast to spread",
    description:
      "Fast to adopt, easy to show to other people, often spread through immediate usefulness.",
  },
  Infrastructure: {
    color: "#819f88",
    tagline: "Slow to bloom, load-bearing",
    description:
      "Foundational systems, frameworks, and tools that support a lot of downstream work.",
  },
  Utility: {
    color: "#c9b07d",
    tagline: "Small, sharp, everywhere",
    description:
      "Smaller practical tools that fit into personal workflows without becoming broad platforms.",
  },
  Learning: {
    color: "#d8cfc0",
    tagline: "Docs and curricula",
    description:
      "Repos that teach, document, or help people enter a field through examples and guides.",
  },
  Creative: {
    color: "#b48b73",
    tagline: "Tools for making",
    description:
      "Tools oriented toward expression, experimentation, or making media, art, games, and interfaces.",
  },
  Startup: {
    color: "#d6a26c",
    tagline: "The gold rush belt",
    description:
      "Product-minded tools that package a bigger workflow or business use case into something usable.",
  },
  "Ambitious but Obscure": {
    color: "#9e9787",
    tagline: "Vast, few roads",
    description:
      "Strong ideas and deeper commitments, but with smaller audiences or more specialized appeal.",
  },
  "Developer Experience": {
    color: "#8f7fa8",
    tagline: "Friction, reduced",
    description:
      "Tools that reduce developer friction through better workflows, packaging, automation, and local tooling.",
  },
  "Data & AI": {
    color: "#7b9baa",
    tagline: "Models, pipelines, inference",
    description:
      "Projects centered on data pipelines, ML systems, model tooling, search, inference, and analytics.",
  },
  "Security & Privacy": {
    color: "#7e8c73",
    tagline: "Hardening the commons",
    description:
      "Libraries and platforms for protecting systems, identities, secrets, networks, and user data.",
  },
  "Scientific Computing": {
    color: "#8d8db4",
    tagline: "Research and simulation",
    description:
      "Research and numerical computing tools used for simulation, statistics, optimization, and reproducible science.",
  },
  "Community Knowledge": {
    color: "#b09478",
    tagline: "Standards and memory",
    description:
      "Documentation ecosystems, standards, educational content, and community-maintained reference projects.",
  },
  "Protocols & Networks": {
    color: "#78938e",
    tagline: "Coordination layers",
    description:
      "Projects focused on internet protocols, distributed systems, networking primitives, and coordination layers.",
  },
};

// ── Subcategory definitions per island ───────────────────────────────────────

export const ISLAND_SUBCATEGORIES = {
  "Viral Tools":           ["Frontend", "Frameworks", "Developer Experience", "CLI Tools"],
  "Infrastructure":        ["Machine Learning", "Cloud Native", "Databases", "Operating Systems", "DevOps"],
  "Startup":               ["AI Apps", "Backend Platforms", "Fullstack Frameworks", "Productivity"],
  "Creative":              ["Game Development", "Generative AI", "Graphics", "Media"],
  "Utility":               ["Formatting & Linting", "Validation", "HTTP", "Automation"],
  "Learning":              ["Roadmaps", "Tutorials", "Interview Prep", "Computer Science"],
  "Ambitious but Obscure": ["Niche Languages", "Experimental Systems", "Research Tools", "Strange Ideas"],
};

// ── Keyword rules for subcategory classification ──────────────────────────────
// Ordered: first match wins. Each rule matches on lowercased combined text.

const SUBCATEGORY_RULES = [
  // ── Viral Tools ────────────────────────────────────────────────────────
  { island: "Viral Tools", sub: "Frontend",
    keys: ["react", "vue", "angular", "svelte", "solid", "tailwind", "css framework",
           "ui library", "component library", "next.js", "nuxt", "remix", "ui kit",
           "design system", "web components", "dom"] },
  { island: "Viral Tools", sub: "Frameworks",
    keys: ["framework", "typescript", "node.js", "deno", "bun", "fastapi", "django",
           "flask", "spring", "laravel", "rails", "express", "fastify", "runtime",
           "api framework", "web framework"] },
  { island: "Viral Tools", sub: "Developer Experience",
    keys: ["vite", "webpack", "eslint", "prettier", "lint", "format", "bundler",
           "compiler", "code editor", "devtools", "hot reload", "monorepo"] },
  { island: "Viral Tools", sub: "CLI Tools",
    keys: ["cli", "command-line", "terminal", "shell", "tui", "zsh", "bash", "command line"] },

  // ── Infrastructure ─────────────────────────────────────────────────────
  { island: "Infrastructure", sub: "Machine Learning",
    keys: ["tensorflow", "pytorch", "machine learning", "ml framework", "deep learning",
           "neural network", "model training", "ml library", "scikit", "keras",
           "hugging face", "transformers", "nlp", "computer vision"] },
  { island: "Infrastructure", sub: "Cloud Native",
    keys: ["kubernetes", "k8s", "docker", "container", "terraform", "helm",
           "service mesh", "serverless", "openshift", "cncf", "argo", "cloud native",
           "orchestration", "infrastructure as code"] },
  { island: "Infrastructure", sub: "Databases",
    keys: ["database", "postgres", "postgresql", "mysql", "mongodb", "redis",
           "sqlite", "cassandra", "elasticsearch", "neo4j", "influx", "clickhouse",
           "cockroach", "mariadb", "sql", "nosql", "orm", "prisma", "query engine",
           "distributed database", "key-value"] },
  { island: "Infrastructure", sub: "Operating Systems",
    keys: ["linux", "kernel", "android", "bsd", "unix", "operating system", "freebsd",
           "package manager", "homebrew", "apt", "nix", "os kernel"] },
  { island: "Infrastructure", sub: "DevOps",
    keys: ["pipeline", "deploy", "jenkins", "ansible", "puppet", "chef",
           "monitoring", "grafana", "prometheus", "devops", "gitops", "build tool",
           "ci/cd", "automation platform", "observability"] },

  // ── Startup ────────────────────────────────────────────────────────────
  { island: "Startup", sub: "AI Apps",
    keys: ["langchain", "llm", "gpt", "chatbot", "openai", "copilot", "whisper",
           "speech recognition", "ai-powered", "large language", "ai app",
           "ai framework", "vector", "embedding", "rag"] },
  { island: "Startup", sub: "Backend Platforms",
    keys: ["supabase", "firebase", "appwrite", "backend platform", "backend as a service",
           "api platform", "baas", "paas", "saas platform", "headless"] },
  { island: "Startup", sub: "Fullstack Frameworks",
    keys: ["electron", "fullstack", "full-stack", "desktop app", "desktop application",
           "boilerplate", "starter kit", "storybook", "ui dev", "monorepo template",
           "cross-platform", "app framework"] },
  { island: "Startup", sub: "Productivity",
    keys: ["todo", "task manager", "calendar", "note-taking", "productivity",
           "project management", "collaboration", "obsidian", "notion", "workflow tool"] },

  // ── Creative ───────────────────────────────────────────────────────────
  { island: "Creative", sub: "Game Development",
    keys: ["game engine", "game dev", "godot", "phaser", "pygame", "gamedev",
           "game", "unity", "unreal", "game framework"] },
  { island: "Creative", sub: "Generative AI",
    keys: ["stable diffusion", "generative", "diffusion model", "gan", "image generation",
           "text-to-image", "creative ai", "midjourney", "dall-e", "image gen"] },
  { island: "Creative", sub: "Graphics",
    keys: ["three.js", "3d", "opengl", "webgl", "vulkan", "rendering", "shader",
           "blender", "canvas", "svg library", "image processing", "animation",
           "manim", "visualization", "drawing"] },
  { island: "Creative", sub: "Media",
    keys: ["video", "audio", "music", "sound", "media", "streaming", "podcast",
           "ffmpeg", "multimedia", "screen record", "vhs"] },

  // ── Utility ────────────────────────────────────────────────────────────
  { island: "Utility", sub: "Formatting & Linting",
    keys: ["prettier", "eslint", "linting", "formatter", "date-fns", "moment",
           "dayjs", "number format", "string util", "oh my zsh", "zsh config"] },
  { island: "Utility", sub: "Validation",
    keys: ["validation", "schema", "zod", "yup", "joi", "type checking",
           "data validation", "schema validation"] },
  { island: "Utility", sub: "HTTP",
    keys: ["http client", "axios", "fetch", "request library", "rest client",
           "api client", "http", "curl", "public apis", "api directory"] },
  { island: "Utility", sub: "Automation",
    keys: ["automation", "task runner", "cron", "job scheduler", "bot", "scraper",
           "macro", "workflow automation", "script runner"] },

  // ── Learning ───────────────────────────────────────────────────────────
  { island: "Learning", sub: "Roadmaps",
    keys: ["roadmap", "awesome-", "awesome ", "curated list", "resource list",
           "learning path", "curriculum", "developer roadmap"] },
  { island: "Learning", sub: "Tutorials",
    keys: ["tutorial", "guide", "how-to", "learn", "course", "example code",
           "sample app", "demo app", "build your own", "by example"] },
  { island: "Learning", sub: "Interview Prep",
    keys: ["interview", "leetcode", "coding challenge", "cracking the coding",
           "system design", "data structure practice", "competitive programming"] },
  { island: "Learning", sub: "Computer Science",
    keys: ["computer science", "data structures", "algorithms", "cs fundamentals",
           "programming concepts", "theory", "discrete math", "cheat sheet",
           "man pages", "tldr", "reference"] },

  // ── Ambitious but Obscure ──────────────────────────────────────────────
  { island: "Ambitious but Obscure", sub: "Niche Languages",
    keys: ["programming language", "zig", "nix", "lisp", "haskell", "erlang",
           "elixir", "clojure", "forth", "prolog", "compiler", "interpreter",
           "virtual machine", "wasm", "esoteric"] },
  { island: "Ambitious but Obscure", sub: "Experimental Systems",
    keys: ["redox", "operating system in rust", "experimental", "proof of concept",
           "novel approach", "new paradigm", "alternative to"] },
  { island: "Ambitious but Obscure", sub: "Research Tools",
    keys: ["research", "academic", "paper", "formal verification", "theorem",
           "analysis tool", "scientific"] },
  { island: "Ambitious but Obscure", sub: "Strange Ideas",
    keys: ["helix", "zellij", "lapce", "modal editor", "terminal workspace",
           "unconventional", "minimalist", "rethink", "from scratch"] },
];

export function getSubcategory(repo) {
  const island = getContinent(repo);
  const rules = SUBCATEGORY_RULES.filter((r) => r.island === island);
  if (!rules.length) return ISLAND_SUBCATEGORIES[island]?.[0] ?? "General";

  const text = [
    repo.name,
    repo.repo_full_name,
    repo.summary?.description,
    repo.story?.origin,
    repo.story?.motivation,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const rule of rules) {
    if (rule.keys.some((kw) => text.includes(kw))) return rule.sub;
  }

  return ISLAND_SUBCATEGORIES[island]?.[0] ?? "General";
}

export function getContinent(repo) {
  return (
    repo?.taxonomy?.continent ||
    repo?.classification?.continent ||
    repo?.classification?.island ||
    "Unclassified"
  );
}

export function normalizeRepo(repo, index) {
  const continent = getContinent(repo);

  const base = {
    ...repo,
    id:
      repo.id ||
      repo.repo_full_name?.replace("/", "-").toLowerCase() ||
      `${repo.name.toLowerCase().replace(/\s+/g, "-")}-${index}`,
    taxonomy: {
      ...repo.taxonomy,
      continent,
      country: repo.taxonomy?.country || repo.classification?.country || null,
      state: repo.taxonomy?.state || repo.classification?.state || null,
    },
    classification: {
      ...repo.classification,
      continent,
      island: continent,
    },
  };

  // Compute subcategory on the fully normalised object so getContinent() reads correctly
  base.taxonomy.subcategory = getSubcategory(base);
  return base;
}
