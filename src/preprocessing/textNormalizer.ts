import { SearchQuery } from '../ingestion/types';

const SKILLS_DICT: string[] = [
  'Python', 'JavaScript', 'TypeScript', 'Go', 'Rust', 'Java', 'C++', 'C#',
  'Ruby', 'PHP', 'Swift', 'Kotlin', 'React', 'Vue', 'Angular', 'Node.js',
  'Express', 'Django', 'FastAPI', 'Flask', 'Spring', 'PostgreSQL', 'MySQL',
  'MongoDB', 'Redis', 'Elasticsearch', 'Kafka', 'RabbitMQ', 'Docker',
  'Kubernetes', 'AWS', 'GCP', 'Azure', 'Terraform', 'Git', 'Linux',
  'GraphQL', 'REST', 'gRPC', 'Machine Learning', 'Deep Learning',
  'TensorFlow', 'PyTorch', 'Scikit-learn', 'Pandas', 'NumPy', 'SQL',
  'NoSQL', 'React Native', 'Flutter', 'Spark', 'Hadoop', 'Airflow', 'dbt',
  'Databricks', 'Snowflake', 'Tableau', 'Power BI', 'Figma', 'HTML', 'CSS',
  'Tailwind', 'SASS', 'Next.js', 'Nuxt.js', 'nginx', 'Jenkins',
  'GitHub Actions', 'CI/CD', 'DevOps', 'Microservices', 'System Design',
];

const SKILLS_LOWER = SKILLS_DICT.map((s) => ({ original: s, lower: s.toLowerCase() }));

const LOCATION_KEYWORDS: string[] = [
  'bangalore', 'bengaluru', 'mumbai', 'delhi', 'hyderabad', 'chennai',
  'pune', 'kolkata', 'gurgaon', 'gurugram', 'noida', 'remote',
  'new york', 'san francisco', 'london', 'berlin', 'singapore',
];

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s.+#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const { original, lower: skillLower } of SKILLS_LOWER) {
    const regex = new RegExp(`(?<![a-z])${escapeRegex(skillLower)}(?![a-z])`, 'i');
    if (regex.test(lower)) {
      found.push(original);
    }
  }
  return [...new Set(found)];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractExperience(text: string): { min: number; max: number } {
  const lower = text.toLowerCase();

  // "X+ years" — bounded digit match avoids ReDoS
  const plusMatch = lower.match(/(\d{1,2})\+[ \t]*(?:years?|yrs?)/);
  if (plusMatch) {
    const min = parseInt(plusMatch[1], 10);
    return { min, max: min + 5 };
  }

  // "X-Y years"
  const rangeMatch = lower.match(/(\d{1,2})[ \t]*[-–][ \t]*(\d{1,2})[ \t]*(?:years?|yrs?)/);
  if (rangeMatch) {
    return { min: parseInt(rangeMatch[1], 10), max: parseInt(rangeMatch[2], 10) };
  }

  // "X years [of experience]" — avoid optional nested groups that cause ReDoS
  const singleMatch = lower.match(/(\d{1,2})[ \t]*(?:years?|yrs?)/);
  if (singleMatch) {
    const val = parseInt(singleMatch[1], 10);
    return { min: val, max: val };
  }

  // "fresher" or "entry level"
  if (/fresher|entry.?level|no experience|0 years/.test(lower)) {
    return { min: 0, max: 1 };
  }

  // title-based heuristics
  if (/\bsenior\b/.test(lower)) return { min: 5, max: 10 };
  if (/\blead\b|\bstaff\b/.test(lower)) return { min: 6, max: 12 };
  if (/\bprincipal\b|\barchitect\b/.test(lower)) return { min: 8, max: 15 };

  return { min: 0, max: 0 };
}

export function extractLocation(text: string): string | null {
  const lower = text.toLowerCase();
  for (const loc of LOCATION_KEYWORDS) {
    if (lower.includes(loc)) {
      // Return canonical form
      if (loc === 'bengaluru') return 'Bangalore';
      return loc.charAt(0).toUpperCase() + loc.slice(1);
    }
  }
  return null;
}

export function extractSalary(text: string): number | null {
  const lower = text.toLowerCase();

  // Match patterns like "12lpa", "12 lpa", "12 lakhs", "under 12l"
  // Use indexOf-based pre-filter + simple bounded regex to avoid ReDoS
  const salaryKeywords = ['lpa', 'lakhs', 'lakh', 'lac'];
  const hasSalaryKeyword = salaryKeywords.some((kw) => lower.includes(kw));
  if (!hasSalaryKeyword && !lower.includes('inr') && !lower.includes('₹') && !lower.includes('rs.')) {
    return null;
  }

  // Simple digit extraction: find a number near a salary keyword
  const digitMatch = lower.match(/(\d{1,3}(?:\.\d{1,2})?)\s{0,3}(?:lpa|lakh|lac)/);
  if (digitMatch) {
    return parseFloat(digitMatch[1]);
  }

  // "under/below/max/upto N lpa"
  const prefixMatch = lower.match(/(?:under|below|max|upto)\s{1,5}(\d{1,3}(?:\.\d{1,2})?)/);
  if (prefixMatch) {
    return parseFloat(prefixMatch[1]);
  }

  // "INR/₹/Rs. N"
  const currencyMatch = lower.match(/(?:inr|₹|rs\.)\s{0,3}(\d{1,3}(?:\.\d{1,2})?)/);
  if (currencyMatch) {
    return parseFloat(currencyMatch[1]);
  }

  return null;
}

export function parseQuery(rawQuery: string): SearchQuery {
  const skills = extractSkills(rawQuery);
  const location = extractLocation(rawQuery);
  const exp = extractExperience(rawQuery);
  const salaryMax = extractSalary(rawQuery);

  const lower = rawQuery.toLowerCase();

  // Remote detection
  let remote: boolean | null = null;
  if (/\bremote\b/.test(lower)) remote = true;
  else if (/\bon.?site\b|\bin.?office\b|\bin.?person\b/.test(lower)) remote = false;

  // Job type detection
  let jobType: string | null = null;
  if (/\bintern\b|\binternship\b/.test(lower)) jobType = 'internship';
  else if (/\bcontract\b|\bfreelance\b/.test(lower)) jobType = 'contract';
  else if (/\bfull.?time\b/.test(lower)) jobType = 'full-time';

  // Keywords: meaningful words after stripping common stop words
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'i', 'want', 'am', 'is', 'are', 'looking',
    'job', 'role', 'position', 'work', 'seeking', 'find', 'get', 'need',
    'have', 'my', 'me', 'as', 'be', 'can', 'will', 'would', 'like', 'that',
    'this', 'which', 'who', 'how', 'what', 'where', 'when', 'it', 'its',
  ]);

  const keywords = normalize(rawQuery)
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .filter((w) => !/^\d+$/.test(w));

  return {
    raw: rawQuery,
    skills,
    location,
    experienceMin: exp.min > 0 || exp.max > 0 ? exp.min : null,
    experienceMax: exp.min > 0 || exp.max > 0 ? exp.max : null,
    salaryMax,
    keywords: [...new Set(keywords)],
    remote,
    jobType,
  };
}
