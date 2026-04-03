export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  requirements: string;
  skills: string[];
  experienceMin: number;
  experienceMax: number;
  salaryMin?: number;
  salaryMax?: number;
  jobType: string;
  remote: boolean;
  rawText: string;
  embedding?: number[];
}

export interface Candidate {
  id: string;
  name: string;
  title: string;
  company: string;
  location: string;
  skills: string[];
  bio: string;
  yearsOfExperience: number;
  education: string;
  rawText: string;
  embedding?: number[];
}

export interface SearchResult {
  job: Job;
  score: number;
  semanticScore: number;
  keywordScore: number;
  structuredScore: number;
  explanation: string;
}

export interface SearchQuery {
  raw: string;
  skills: string[];
  location: string | null;
  experienceMin: number | null;
  experienceMax: number | null;
  salaryMax: number | null;
  keywords: string[];
  remote: boolean | null;
  jobType: string | null;
}
