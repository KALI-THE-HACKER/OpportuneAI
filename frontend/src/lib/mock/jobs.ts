export type JobType = "full-time" | "part-time" | "contract" | "internship";
export type WorkMode = "remote" | "hybrid" | "on-site";
export type ApplicationStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected";

export interface Job {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  workMode: WorkMode;
  type: JobType;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  postedAt: string; // ISO
  description: string;
  responsibilities: string[];
  requirements: string[];
  skills: string[];
  matchScore: number;
  missingSkills: string[];
  matchedSkills: string[];
  aiExplanation: string;
  experienceLevel: "Entry" | "Mid" | "Senior" | "Lead" | "Principal";
  saved?: boolean;
}

const skillsPool = [
  "TypeScript","React","Node.js","Python","Rust","Go","Kubernetes","Docker","AWS","GCP",
  "PostgreSQL","Redis","GraphQL","REST APIs","Distributed Systems","Machine Learning",
  "LLMs","PyTorch","TensorFlow","Figma","Design Systems","Tailwind CSS","Next.js",
  "Stakeholder Management","SQL Advanced Analytics","System Design","CI/CD","Terraform"
];

const companies = [
  "Linear Operations","Framework Labs","Quantum Infrastructure","Neural Dynamics",
  "Lumina Systems","Vercel","Synthetix","Orbit Logic","Helix AI","Northwind Cloud",
  "Cluster Systems","Argon Labs","Vector Foundry","Meridian Health","Atlas Compute"
];

const locations = [
  "New York, NY","San Francisco, CA","Remote","Berlin, DE","London, UK",
  "Tokyo, JP","Toronto, CA","Austin, TX","Amsterdam, NL","Singapore"
];

const titles = [
  "Senior Systems Architect","Product Strategy Lead","Staff Software Engineer",
  "AI Research Lead","Senior UX Engineer","Principal Platform Engineer",
  "Engineering Manager","Senior Product Designer","Backend Engineer",
  "ML Infrastructure Engineer","Full Stack Developer","Site Reliability Engineer",
  "Lead Product Manager","Data Platform Engineer","Frontend Architect"
];

function pick<T>(arr: T[], n: number, seed: number): T[] {
  const out: T[] = [];
  const copy = [...arr];
  let s = seed;
  while (out.length < n && copy.length) {
    s = (s * 9301 + 49297) % 233280;
    const idx = Math.floor((s / 233280) * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

export const MOCK_JOBS: Job[] = Array.from({ length: 48 }).map((_, i) => {
  const skills = pick(skillsPool, 6, i + 1);
  const matched = skills.slice(0, 4);
  const missing = pick(skillsPool.filter(s => !matched.includes(s)), 2, i + 7);
  const match = 60 + ((i * 13) % 40);
  const minSal = 90 + ((i * 17) % 180);
  const maxSal = minSal + 30 + ((i * 7) % 80);
  const modes: WorkMode[] = ["remote","hybrid","on-site"];
  const types: JobType[] = ["full-time","contract","full-time","part-time"];
  const lvls: Job["experienceLevel"][] = ["Mid","Senior","Lead","Principal","Senior"];
  return {
    id: `job-${String(i + 1).padStart(3, "0")}`,
    title: titles[i % titles.length],
    company: companies[i % companies.length],
    location: locations[i % locations.length],
    workMode: modes[i % 3],
    type: types[i % 4],
    salaryMin: minSal * 1000,
    salaryMax: maxSal * 1000,
    currency: "USD",
    postedAt: new Date(Date.now() - i * 1000 * 60 * 60 * 6).toISOString(),
    description:
      "We're building the next generation of intelligent infrastructure. Join a senior team shipping at velocity to a global customer base.",
    responsibilities: [
      "Architect and ship core platform services end-to-end",
      "Partner with product and design on roadmap decisions",
      "Mentor engineers and raise the technical bar",
      "Own production reliability and on-call rotation"
    ],
    requirements: [
      "7+ years building production systems at scale",
      "Deep expertise in at least two languages from the stack",
      "Track record of shipping in ambiguous environments",
      "Strong written and verbal communication"
    ],
    skills,
    matchScore: match,
    missingSkills: missing,
    matchedSkills: matched,
    aiExplanation:
      "Your experience overlaps strongly with this team's stack and product surface. Filling the missing skill gaps would bring you above a 95% fit and unlock the upper compensation band.",
    experienceLevel: lvls[i % lvls.length],
    saved: i % 7 === 0
  };
});

export const APPLIED_JOB_IDS = ["job-002", "job-005", "job-008", "job-011", "job-014"];
export const SAVED_JOB_IDS = MOCK_JOBS.filter(j => j.saved).map(j => j.id);

export interface ApplicationRecord {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  appliedAt: string;
  lastUpdate: string;
  notes?: string;
}

export const MOCK_APPLICATIONS: ApplicationRecord[] = APPLIED_JOB_IDS.map((jobId, i) => ({
  id: `app-${i + 1}`,
  jobId,
  status: (["applied","interviewing","applied","offer","rejected"] as ApplicationStatus[])[i],
  appliedAt: new Date(Date.now() - (i + 1) * 86400000 * 3).toISOString(),
  lastUpdate: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
  notes: i === 1 ? "Second-round technical scheduled for next Tuesday." : undefined
}));