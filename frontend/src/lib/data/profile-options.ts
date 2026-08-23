export const EXPERIENCE_LEVELS = [
  "Intern",
  "Junior (1-2 yrs)",
  "Mid-Level (3-5 yrs)",
  "Senior (5-8 yrs)",
  "Staff (8-12 yrs)",
  "Principal (12+ yrs)",
  "Lead / Engineering Manager",
  "Director / Executive",
] as const;

export const STANDARD_JOB_TITLES = [
  // Internships
  "Software Engineering Intern",
  "Frontend Developer Intern",
  "Backend Developer Intern",
  "Full Stack Developer Intern",
  "Machine Learning / AI Intern",
  "Data Science Intern",
  "Data Engineering Intern",
  "Mobile App Development Intern",
  "DevOps / Cloud Intern",
  "Cybersecurity Intern",
  "QA / Test Engineering Intern",
  "Product Management Intern",
  "UI/UX Design Intern",

  // Core Software Engineering
  "Software Engineer",
  "Junior Software Engineer",
  "Senior Software Engineer",
  "Staff Software Engineer",
  "Principal Software Engineer",
  "Lead Software Engineer",
  "Frontend Engineer",
  "Senior Frontend Engineer",
  "Backend Engineer",
  "Senior Backend Engineer",
  "Full Stack Engineer",
  "Senior Full Stack Engineer",

  // Specialized Domains
  "AI Engineer",
  "Generative AI / LLM Engineer",
  "Machine Learning Engineer",
  "AI Research Scientist",
  "Data Scientist",
  "Senior Data Scientist",
  "Data Engineer",
  "Big Data Engineer",
  "Data Analyst",

  // Infrastructure & Cloud
  "DevOps Engineer",
  "Platform Engineer",
  "Site Reliability Engineer (SRE)",
  "Cloud Solutions Architect",
  "Infrastructure Engineer",
  "Kubernetes / Systems Engineer",
  "Database Engineer / DBA",

  // Mobile & Applications
  "iOS Developer (Swift / SwiftUI)",
  "Android Developer (Kotlin)",
  "React Native Developer",
  "Flutter Developer",
  "Mobile App Engineer",

  // Quality, Security & Low-Level
  "SDET (Software Development Engineer in Test)",
  "QA Automation Engineer",
  "Security Engineer / AppSec",
  "Penetration Tester",
  "Embedded Systems Engineer",
  "Firmware Engineer",
  "Systems / Kernel Engineer",
  "Blockchain / Web3 Engineer",
  "Game Developer (Unity / Unreal)",

  // Product & Leadership
  "Product Manager",
  "Technical Product Manager",
  "Senior Product Manager",
  "Product Designer",
  "UI/UX Designer",
  "Technical Lead",
  "Engineering Manager",
  "Director of Engineering",
  "VP of Technology",
  "CTO",
] as const;

export const STANDARD_LOCATIONS = [
  "Remote",
  "San Francisco, CA",
  "New York, NY",
  "Seattle, WA",
  "Austin, TX",
  "Boston, MA",
  "Los Angeles, CA",
  "Chicago, IL",
  "Denver, CO",
  "London, UK",
  "Berlin, Germany",
  "Amsterdam, Netherlands",
  "Paris, France",
  "Dublin, Ireland",
  "Toronto, Canada",
  "Vancouver, Canada",
  "Bangalore, India",
  "Hyderabad, India",
  "Pune, India",
  "Delhi NCR, India",
  "Mumbai, India",
  "Singapore",
  "Tokyo, Japan",
  "Sydney, Australia",
  "Zurich, Switzerland",
] as const;

export const STANDARD_ROLES = [
  // Internships
  "Software Engineering Intern",
  "Frontend Intern",
  "Backend Intern",
  "Full Stack Intern",
  "Machine Learning Intern",
  "Data Science Intern",
  "Data Engineering Intern",
  "Mobile Developer Intern",
  "DevOps Intern",
  "Cybersecurity Intern",
  "QA Intern",
  "Product Management Intern",

  // Web & Core Development
  "Frontend Engineer",
  "Backend Engineer",
  "Full Stack Engineer",
  "Junior Software Engineer",
  "Senior Software Engineer",
  "Staff Software Engineer",
  "Principal Engineer",

  // AI & Data
  "Machine Learning Engineer",
  "AI / LLM Engineer",
  "Data Scientist",
  "Data Engineer",
  "Data Analyst",
  "AI Research Scientist",

  // Cloud & DevOps
  "DevOps Engineer",
  "Platform Engineer",
  "Site Reliability Engineer (SRE)",
  "Cloud Solutions Architect",
  "Infrastructure Engineer",
  "Database Administrator / Engineer",

  // Mobile & Client
  "Mobile Developer (iOS / Android)",
  "iOS Engineer",
  "Android Engineer",
  "React Native Developer",
  "Flutter Developer",

  // Security, Testing & Systems
  "Security Engineer",
  "QA Automation Engineer",
  "SDET",
  "Embedded / IoT Engineer",
  "Systems Engineer",
  "Blockchain Developer",
  "Game Developer",

  // Product & Management
  "Product Manager",
  "Technical Product Manager",
  "Product Designer (UI/UX)",
  "Engineering Manager",
  "Technical Lead / Architect",
] as const;

/**
 * Filter suggestions by query with substring matching.
 */
export function filterSuggestions(
  items: readonly string[],
  query: string,
  exclude: readonly string[] = [],
): string[] {
  const normQuery = query.trim().toLowerCase();
  const excludeSet = new Set(exclude.map((s) => s.toLowerCase()));

  const filtered = items.filter((item) => !excludeSet.has(item.toLowerCase()));

  if (!normQuery) {
    return filtered.slice(0, 8);
  }

  const exact: string[] = [];
  const prefix: string[] = [];
  const substring: string[] = [];

  for (const item of filtered) {
    const norm = item.toLowerCase();
    if (norm === normQuery) {
      exact.push(item);
    } else if (norm.startsWith(normQuery)) {
      prefix.push(item);
    } else if (norm.includes(normQuery)) {
      substring.push(item);
    }
  }

  return [...exact, ...prefix, ...substring].slice(0, 10);
}
