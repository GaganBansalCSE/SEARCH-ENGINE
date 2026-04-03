import { Job, SearchQuery, SearchResult } from '../ingestion/types';

export class ExplanationEngine {
  generate(
    job: Job,
    query: SearchQuery,
    result: Omit<SearchResult, 'explanation'>,
  ): string {
    const lines: string[] = ['This job matches because:'];

    // Skill overlap
    const jobSkillsLower = job.skills.map((s) => s.toLowerCase());
    const matchedSkills = query.skills.filter((s) =>
      jobSkillsLower.includes(s.toLowerCase()),
    );

    if (matchedSkills.length > 0) {
      const total = Math.max(query.skills.length, job.skills.length);
      lines.push(
        `- Strong skill overlap: ${matchedSkills.slice(0, 5).join(', ')} (${matchedSkills.length}/${total} skills matched)`,
      );
    } else if (query.skills.length > 0) {
      lines.push(`- Limited skill overlap: job requires ${job.skills.slice(0, 3).join(', ')}`);
    } else if (job.skills.length > 0) {
      lines.push(`- Job requires: ${job.skills.slice(0, 5).join(', ')}`);
    }

    // Location
    if (
      query.location &&
      job.location.toLowerCase().includes(query.location.toLowerCase())
    ) {
      lines.push(`- Location match: ${job.location}`);
    } else if (job.remote && query.remote === true) {
      lines.push(`- Remote position matches your preference`);
    } else if (query.location) {
      lines.push(`- Location: ${job.location} (query: ${query.location})`);
    }

    // Semantic similarity — semanticPct used in the Overall scores line
    const semanticPct = Math.round(result.semanticScore * 100);
    lines.push(
      `- Role similarity: ${job.title} at ${job.company} (semantic score: ${result.semanticScore.toFixed(2)})`,
    );

    // Experience
    if (query.experienceMin !== null && query.experienceMax !== null) {
      const overlap =
        query.experienceMin <= job.experienceMax &&
        query.experienceMax >= job.experienceMin;
      if (overlap) {
        lines.push(
          `- Experience range matches: ${job.experienceMin}-${job.experienceMax} years required, query asks for ${query.experienceMin}-${query.experienceMax} years`,
        );
      } else {
        lines.push(
          `- Experience mismatch: ${job.experienceMin}-${job.experienceMax} years required, query asks for ${query.experienceMin}-${query.experienceMax} years`,
        );
      }
    } else if (query.experienceMin !== null) {
      lines.push(
        `- Experience: job requires ${job.experienceMin}-${job.experienceMax} years, query asks for ${query.experienceMin}+ years`,
      );
    }

    // Salary
    if (query.salaryMax !== null && job.salaryMax !== undefined) {
      if (job.salaryMax <= query.salaryMax) {
        lines.push(
          `- Salary fits: up to ${job.salaryMax} LPA (within your max of ${query.salaryMax} LPA)`,
        );
      } else {
        lines.push(
          `- Salary above budget: ${job.salaryMax} LPA (your max: ${query.salaryMax} LPA)`,
        );
      }
    }

    // Keyword matches
    const queryKeywords = query.keywords;
    const rawLower = job.rawText.toLowerCase();
    const matchedKeywords = queryKeywords
      .filter((k) => rawLower.includes(k.toLowerCase()))
      .slice(0, 5);
    if (matchedKeywords.length > 0) {
      lines.push(`- Keyword matches: ${matchedKeywords.join(', ')}`);
    }

    // Job type
    if (query.jobType && job.jobType === query.jobType) {
      lines.push(`- Job type match: ${job.jobType}`);
    }

    // Overall scores
    lines.push(
      `- Overall: Semantic ${semanticPct}% | Keyword ${Math.round(result.keywordScore * 100)}% | Structured ${Math.round(result.structuredScore * 100)}%`,
    );

    // Unmatched skills from query
    const unmatchedSkills = query.skills.filter(
      (s) => !jobSkillsLower.includes(s.toLowerCase()),
    );
    if (unmatchedSkills.length > 0 && query.skills.length > 0) {
      lines.push(`- Missing skills: ${unmatchedSkills.slice(0, 3).join(', ')}`);
    }

    return lines.join('\n');
  }
}
