export type Job = {
  title: string;
  company: string;
  location: string;
  description: string;
  url?: string;
};

export type ResumeData = {
  name: string;
  phone?: string;
  email?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  educationFirst?: boolean;
  education: { school: string; location?: string; degree: string; dates?: string }[];
  experience: {
    title: string;
    dates?: string;
    company: string;
    location?: string;
    bullets: string[];
  }[];
  projects: { name: string; tech?: string; dates?: string; bullets: string[] }[];
  skills: { category: string; items: string }[];
};

export type Tailored = {
  profession: string;
  overview: string;
  keywords: string[];
  gaps: string[];
  resume: ResumeData;
};

export type UploadedFile = { name: string; mime: string; data: string };
