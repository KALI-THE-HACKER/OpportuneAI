export interface SkillItem {
  name: string;
  category: string;
}

export const SYSTEM_SKILLS: SkillItem[] = [
  // Languages
  { name: "Python", category: "Languages" },
  { name: "JavaScript", category: "Languages" },
  { name: "TypeScript", category: "Languages" },
  { name: "Java", category: "Languages" },
  { name: "C++", category: "Languages" },
  { name: "C#", category: "Languages" },
  { name: "Go", category: "Languages" },
  { name: "Rust", category: "Languages" },
  { name: "Ruby", category: "Languages" },
  { name: "PHP", category: "Languages" },
  { name: "Swift", category: "Languages" },
  { name: "Kotlin", category: "Languages" },
  { name: "Scala", category: "Languages" },
  { name: "R", category: "Languages" },
  { name: "Dart", category: "Languages" },
  { name: "SQL", category: "Languages" },
  { name: "HTML5", category: "Languages" },
  { name: "CSS3", category: "Languages" },
  { name: "Bash", category: "Languages" },
  { name: "Shell Scripting", category: "Languages" },
  { name: "PowerShell", category: "Languages" },
  { name: "C", category: "Languages" },
  { name: "Elixir", category: "Languages" },
  { name: "Clojure", category: "Languages" },
  { name: "Haskell", category: "Languages" },
  { name: "Lua", category: "Languages" },

  // Frontend
  { name: "React", category: "Frontend" },
  { name: "Next.js", category: "Frontend" },
  { name: "Vue.js", category: "Frontend" },
  { name: "Nuxt.js", category: "Frontend" },
  { name: "Angular", category: "Frontend" },
  { name: "Svelte", category: "Frontend" },
  { name: "SvelteKit", category: "Frontend" },
  { name: "Remix", category: "Frontend" },
  { name: "Tailwind CSS", category: "Frontend" },
  { name: "Redux", category: "Frontend" },
  { name: "Zustand", category: "Frontend" },
  { name: "TanStack Query", category: "Frontend" },
  { name: "TanStack Router", category: "Frontend" },
  { name: "Vite", category: "Frontend" },
  { name: "Webpack", category: "Frontend" },
  { name: "Three.js", category: "Frontend" },
  { name: "D3.js", category: "Frontend" },
  { name: "HTML/CSS", category: "Frontend" },
  { name: "Sass/SCSS", category: "Frontend" },
  { name: "Bootstrap", category: "Frontend" },
  { name: "Material UI", category: "Frontend" },
  { name: "shadcn/ui", category: "Frontend" },
  { name: "WebSockets", category: "Frontend" },
  { name: "WebRTC", category: "Frontend" },

  // Backend
  { name: "Node.js", category: "Backend" },
  { name: "Express.js", category: "Backend" },
  { name: "FastAPI", category: "Backend" },
  { name: "Django", category: "Backend" },
  { name: "Flask", category: "Backend" },
  { name: "Spring Boot", category: "Backend" },
  { name: "ASP.NET Core", category: "Backend" },
  { name: "Ruby on Rails", category: "Backend" },
  { name: "Laravel", category: "Backend" },
  { name: "NestJS", category: "Backend" },
  { name: "Gin", category: "Backend" },
  { name: "Actix Web", category: "Backend" },
  { name: "Axum", category: "Backend" },
  { name: "GraphQL", category: "Backend" },
  { name: "REST APIs", category: "Backend" },
  { name: "gRPC", category: "Backend" },
  { name: "Celery", category: "Backend" },
  { name: "Redis Queue (RQ)", category: "Backend" },
  { name: "RabbitMQ", category: "Backend" },
  { name: "Apache Kafka", category: "Backend" },

  // Databases
  { name: "PostgreSQL", category: "Databases" },
  { name: "MySQL", category: "Databases" },
  { name: "SQLite", category: "Databases" },
  { name: "MongoDB", category: "Databases" },
  { name: "Redis", category: "Databases" },
  { name: "Elasticsearch", category: "Databases" },
  { name: "Cassandra", category: "Databases" },
  { name: "DynamoDB", category: "Databases" },
  { name: "Supabase", category: "Databases" },
  { name: "Firebase", category: "Databases" },
  { name: "Neo4j", category: "Databases" },
  { name: "ClickHouse", category: "Databases" },
  { name: "Cloudflare R2", category: "Databases" },
  { name: "AWS S3", category: "Databases" },

  // Cloud & DevOps
  { name: "Docker", category: "Cloud & DevOps" },
  { name: "Kubernetes", category: "Cloud & DevOps" },
  { name: "AWS", category: "Cloud & DevOps" },
  { name: "Google Cloud Platform (GCP)", category: "Cloud & DevOps" },
  { name: "Microsoft Azure", category: "Cloud & DevOps" },
  { name: "Terraform", category: "Cloud & DevOps" },
  { name: "CI/CD", category: "Cloud & DevOps" },
  { name: "GitHub Actions", category: "Cloud & DevOps" },
  { name: "GitLab CI", category: "Cloud & DevOps" },
  { name: "Linux", category: "Cloud & DevOps" },
  { name: "Nginx", category: "Cloud & DevOps" },
  { name: "Cloudflare", category: "Cloud & DevOps" },
  { name: "Helm", category: "Cloud & DevOps" },
  { name: "Prometheus", category: "Cloud & DevOps" },
  { name: "Grafana", category: "Cloud & DevOps" },
  { name: "Ansible", category: "Cloud & DevOps" },
  { name: "Serverless", category: "Cloud & DevOps" },
  { name: "Vercel", category: "Cloud & DevOps" },

  // AI & Data
  { name: "Machine Learning", category: "AI & Data" },
  { name: "Deep Learning", category: "AI & Data" },
  { name: "Generative AI", category: "AI & Data" },
  { name: "Large Language Models (LLMs)", category: "AI & Data" },
  { name: "LangChain", category: "AI & Data" },
  { name: "LlamaIndex", category: "AI & Data" },
  { name: "PyTorch", category: "AI & Data" },
  { name: "TensorFlow", category: "AI & Data" },
  { name: "Scikit-learn", category: "AI & Data" },
  { name: "OpenCV", category: "AI & Data" },
  { name: "Natural Language Processing (NLP)", category: "AI & Data" },
  { name: "Computer Vision", category: "AI & Data" },
  { name: "Pandas", category: "AI & Data" },
  { name: "NumPy", category: "AI & Data" },
  { name: "Hugging Face", category: "AI & Data" },
  { name: "Gemini API", category: "AI & Data" },
  { name: "OpenAI API", category: "AI & Data" },
  { name: "Anthropic API", category: "AI & Data" },
  { name: "Vector Databases", category: "AI & Data" },
  { name: "Pinecone", category: "AI & Data" },
  { name: "ChromaDB", category: "AI & Data" },
  { name: "Qdrant", category: "AI & Data" },
  { name: "Milvus", category: "AI & Data" },
  { name: "Prompt Engineering", category: "AI & Data" },
  { name: "Data Analysis", category: "AI & Data" },
  { name: "Data Engineering", category: "AI & Data" },
  { name: "Apache Spark", category: "AI & Data" },
  { name: "Apache Airflow", category: "AI & Data" },

  // Mobile
  { name: "React Native", category: "Mobile" },
  { name: "Flutter", category: "Mobile" },
  { name: "iOS Development", category: "Mobile" },
  { name: "Android Development", category: "Mobile" },
  { name: "SwiftUI", category: "Mobile" },
  { name: "Jetpack Compose", category: "Mobile" },
  { name: "Expo", category: "Mobile" },
  { name: "Ionic", category: "Mobile" },

  // Testing & QA
  { name: "Jest", category: "Testing & QA" },
  { name: "Vitest", category: "Testing & QA" },
  { name: "Cypress", category: "Testing & QA" },
  { name: "Playwright", category: "Testing & QA" },
  { name: "Selenium", category: "Testing & QA" },
  { name: "Pytest", category: "Testing & QA" },
  { name: "JUnit", category: "Testing & QA" },
  { name: "Unit Testing", category: "Testing & QA" },
  { name: "Integration Testing", category: "Testing & QA" },
  { name: "End-to-End (E2E) Testing", category: "Testing & QA" },

  // Security
  { name: "OAuth 2.0", category: "Security" },
  { name: "OpenID Connect (OIDC)", category: "Security" },
  { name: "JSON Web Tokens (JWT)", category: "Security" },
  { name: "Web Security", category: "Security" },
  { name: "OWASP", category: "Security" },
  { name: "Auth0", category: "Security" },
  { name: "Cryptography", category: "Security" },
  { name: "IAM", category: "Security" },
  { name: "Single Sign-On (SSO)", category: "Security" },

  // Architecture & Practices
  { name: "Microservices", category: "Architecture & Practices" },
  { name: "System Design", category: "Architecture & Practices" },
  { name: "Event-Driven Architecture", category: "Architecture & Practices" },
  { name: "Clean Architecture", category: "Architecture & Practices" },
  { name: "Domain-Driven Design (DDD)", category: "Architecture & Practices" },

  // Management & Tools
  { name: "Agile", category: "Management & Tools" },
  { name: "Scrum", category: "Management & Tools" },
  { name: "Kanban", category: "Management & Tools" },
  { name: "Git", category: "Management & Tools" },
  { name: "GitHub", category: "Management & Tools" },
  { name: "GitLab", category: "Management & Tools" },
  { name: "Jira", category: "Management & Tools" },
  { name: "Linear", category: "Management & Tools" },
  { name: "Product Management", category: "Management & Tools" },
  { name: "Code Review", category: "Management & Tools" },
  { name: "Technical Leadership", category: "Management & Tools" },
];

export const SYSTEM_SKILL_NAMES: string[] = SYSTEM_SKILLS.map((s) => s.name);

const LOWER_TO_SKILL_MAP = new Map<string, string>();
SYSTEM_SKILLS.forEach((s) => {
  LOWER_TO_SKILL_MAP.set(s.name.toLowerCase(), s.name);
});

/**
 * Checks if a skill name exists in the system (case-insensitive)
 * and returns the normalized canonical name.
 */
export function normalizeSystemSkill(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  return LOWER_TO_SKILL_MAP.get(trimmed) ?? null;
}

/**
 * Searches system skills by query string (case-insensitive substring/prefix match).
 * Excludes already selected skills.
 */
export function searchSystemSkills(query: string, exclude: string[] = []): SkillItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  const excludeSet = new Set(exclude.map((s) => s.toLowerCase()));

  if (!normalizedQuery) {
    return SYSTEM_SKILLS.filter((s) => !excludeSet.has(s.name.toLowerCase())).slice(0, 10);
  }

  const matches: { item: SkillItem; score: number }[] = [];

  for (const skill of SYSTEM_SKILLS) {
    const lowerName = skill.name.toLowerCase();
    if (excludeSet.has(lowerName)) continue;

    if (lowerName === normalizedQuery) {
      matches.push({ item: skill, score: 0 });
    } else if (lowerName.startsWith(normalizedQuery)) {
      matches.push({ item: skill, score: 1 });
    } else if (lowerName.includes(normalizedQuery)) {
      matches.push({ item: skill, score: 2 });
    } else if (skill.category.toLowerCase().includes(normalizedQuery)) {
      matches.push({ item: skill, score: 3 });
    }
  }

  return matches.sort((a, b) => a.score - b.score).map((m) => m.item);
}
