import { Job, SearchQuery } from '../ingestion/types';

export interface StructuredScore {
  total: number;
  locationMatch: boolean;
  experienceMatch: boolean;
  salaryMatch: boolean;
  remoteMatch: boolean;
  skillOverlap: number;
  matchedSkills: string[];
}

export class StructuredRanker {
  score(query: SearchQuery, job: Job): StructuredScore {
    let total = 0;

    // --- Location match (0.25) ---
    const locationMatch =
      query.location !== null &&
      job.location.toLowerCase().includes(query.location.toLowerCase());
    if (locationMatch) total += 0.25;

    // --- Experience match (0.25) ---
    let experienceMatch = false;
    if (query.experienceMin !== null && query.experienceMax !== null) {
      // Overlapping ranges: [queryMin, queryMax] ∩ [jobMin, jobMax] != empty
      experienceMatch =
        query.experienceMin <= job.experienceMax &&
        query.experienceMax >= job.experienceMin;
    } else if (query.experienceMin !== null) {
      experienceMatch = query.experienceMin <= job.experienceMax;
    } else {
      // No experience constraint in query — partial credit
      experienceMatch = true;
      total += 0.10; // partial
    }
    if (experienceMatch && query.experienceMin !== null) total += 0.25;

    // --- Salary match (0.15) ---
    let salaryMatch = false;
    if (query.salaryMax !== null) {
      if (job.salaryMin !== undefined && job.salaryMax !== undefined) {
        salaryMatch = job.salaryMin <= query.salaryMax;
      } else if (job.salaryMax !== undefined) {
        salaryMatch = job.salaryMax <= query.salaryMax;
      } else {
        // No salary info on job → neutral (give partial)
        salaryMatch = true;
        total += 0.07;
      }
      if (salaryMatch && job.salaryMin !== undefined) total += 0.15;
    } else {
      // No salary constraint → neutral
      salaryMatch = true;
      total += 0.08;
    }

    // --- Remote match (0.10) ---
    let remoteMatch = false;
    if (query.remote !== null) {
      remoteMatch = job.remote === query.remote;
      if (remoteMatch) total += 0.10;
    } else {
      // No remote preference → neutral
      remoteMatch = true;
      total += 0.05;
    }

    // --- Skill overlap (0.25) via Jaccard similarity ---
    const querySkillsLower = query.skills.map((s) => s.toLowerCase());
    const jobSkillsLower = job.skills.map((s) => s.toLowerCase());

    const matchedSkills: string[] = [];
    for (const qs of query.skills) {
      if (jobSkillsLower.includes(qs.toLowerCase())) {
        matchedSkills.push(qs);
      }
    }

    let skillOverlap = 0;
    if (querySkillsLower.length > 0 || jobSkillsLower.length > 0) {
      const union = new Set([...querySkillsLower, ...jobSkillsLower]);
      const intersection = querySkillsLower.filter((s) => jobSkillsLower.includes(s));
      skillOverlap = intersection.length / union.size;
    } else {
      skillOverlap = 0.5; // no skill info — neutral
    }
    total += 0.25 * skillOverlap;

    return {
      total: Math.min(1, Math.max(0, total)),
      locationMatch,
      experienceMatch,
      salaryMatch,
      remoteMatch,
      skillOverlap,
      matchedSkills,
    };
  }
}
