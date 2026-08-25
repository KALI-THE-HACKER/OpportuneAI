export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role?: "admin" | "user";
  title: string;
  location: string;
  avatarUrl?: string;
  bio: string;
  yearsOfExperience: number;
  skills: string[];
  preferredRoles: string[];
  preferredLocations: string[];
  workModes: ("remote" | "hybrid" | "on-site")[];
  minSalary: number;
  willingToRelocate?: boolean;
  emailVerified: boolean;
  hasResume?: boolean;
  resumeFileName?: string | null;
  resumeStatus?: "processed" | "processing" | "failed" | null;
}

export const MOCK_USER: UserProfile = {
  id: "user-1",
  name: "Alex Chen",
  email: "alex@example.com",
  role: "user",
  title: "Senior Product Designer",
  location: "New York, NY",
  bio: "Designer-engineer hybrid focused on tools for technical teams. 8 years shipping design systems, AI products, and developer infrastructure.",
  yearsOfExperience: 8,
  skills: [
    "TypeScript",
    "React",
    "Figma",
    "Design Systems",
    "Tailwind CSS",
    "Next.js",
    "Distributed Systems",
  ],
  preferredRoles: ["Senior Product Designer", "Design Engineer", "Staff Designer"],
  preferredLocations: ["Remote", "New York, NY", "San Francisco, CA"],
  workModes: ["remote", "hybrid"],
  minSalary: 160000,
  willingToRelocate: false,
  emailVerified: true,
};

export interface ResumeData {
  fileName: string;
  uploadedAt: string;
  sizeKb: number;
  status: "processed" | "processing" | "failed";
  extractedSkills: string[];
  experienceLevel: string;
  yearsTotal: number;
  confidence: number;
}

export const MOCK_RESUME: ResumeData = {
  fileName: "alex_chen_cv_2025.pdf",
  uploadedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  sizeKb: 412,
  status: "processed",
  extractedSkills: [
    "TypeScript",
    "React",
    "Figma",
    "Design Systems",
    "Tailwind CSS",
    "Next.js",
    "Distributed Systems",
  ],
  experienceLevel: "L6 / Senior",
  yearsTotal: 8,
  confidence: 0.87,
};

export interface NotificationItem {
  id: string;
  type: "match" | "application" | "system" | "interview";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    type: "match",
    title: "3 new 90%+ matches found",
    body: "Senior UX Engineer at Lumina Systems and 2 others.",
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    read: false,
  },
  {
    id: "n2",
    type: "interview",
    title: "Interview confirmed",
    body: "Linear Operations — Technical round Tue 10:00 EST.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    read: false,
  },
  {
    id: "n3",
    type: "application",
    title: "Application viewed",
    body: "Vercel viewed your application for Senior UI Engineer.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
    read: true,
  },
  {
    id: "n4",
    type: "system",
    title: "Resume re-analyzed",
    body: "Profile confidence updated to 87%.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    read: true,
  },
];
