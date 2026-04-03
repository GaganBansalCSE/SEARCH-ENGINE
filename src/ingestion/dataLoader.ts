import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { Job, Candidate } from './types';
import { logger } from '../utils/logger';

function buildRawText(obj: Record<string, unknown>): string {
  return Object.values(obj)
    .filter((v) => typeof v === 'string' || typeof v === 'number')
    .join(' ');
}

function normalizeJob(raw: Record<string, unknown>): Job {
  const skills =
    Array.isArray(raw['skills'])
      ? (raw['skills'] as unknown[]).map(String)
      : typeof raw['skills'] === 'string'
      ? (raw['skills'] as string).split(',').map((s) => s.trim())
      : [];

  const job: Job = {
    id: String(raw['id'] ?? ''),
    title: String(raw['title'] ?? ''),
    company: String(raw['company'] ?? ''),
    location: String(raw['location'] ?? ''),
    description: String(raw['description'] ?? ''),
    requirements: String(raw['requirements'] ?? ''),
    skills,
    experienceMin: Number(raw['experienceMin'] ?? 0),
    experienceMax: Number(raw['experienceMax'] ?? 0),
    salaryMin: raw['salaryMin'] !== undefined ? Number(raw['salaryMin']) : undefined,
    salaryMax: raw['salaryMax'] !== undefined ? Number(raw['salaryMax']) : undefined,
    jobType: String(raw['jobType'] ?? 'full-time'),
    remote: Boolean(raw['remote'] ?? false),
    rawText: '',
    embedding: Array.isArray(raw['embedding'])
      ? (raw['embedding'] as number[])
      : undefined,
  };
  job.rawText =
    typeof raw['rawText'] === 'string' && raw['rawText'].length > 0
      ? raw['rawText']
      : buildRawText(raw as Record<string, unknown>);
  return job;
}

function normalizeCandidate(raw: Record<string, unknown>): Candidate {
  const skills =
    Array.isArray(raw['skills'])
      ? (raw['skills'] as unknown[]).map(String)
      : typeof raw['skills'] === 'string'
      ? (raw['skills'] as string).split(',').map((s) => s.trim())
      : [];

  const candidate: Candidate = {
    id: String(raw['id'] ?? ''),
    name: String(raw['name'] ?? ''),
    title: String(raw['title'] ?? ''),
    company: String(raw['company'] ?? ''),
    location: String(raw['location'] ?? ''),
    skills,
    bio: String(raw['bio'] ?? ''),
    yearsOfExperience: Number(raw['yearsOfExperience'] ?? 0),
    education: String(raw['education'] ?? ''),
    rawText: '',
    embedding: Array.isArray(raw['embedding'])
      ? (raw['embedding'] as number[])
      : undefined,
  };
  candidate.rawText =
    typeof raw['rawText'] === 'string' && raw['rawText'].length > 0
      ? raw['rawText']
      : buildRawText(raw as Record<string, unknown>);
  return candidate;
}

export function loadJobs(dataDir: string): Job[] {
  const jsonPath = path.join(dataDir, 'jobs.json');
  const csvPath = path.join(dataDir, 'jobs.csv');

  if (fs.existsSync(jsonPath)) {
    logger.info(`Loading jobs from ${jsonPath}`);
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as Record<string, unknown>[];
    return raw.map(normalizeJob);
  }

  if (fs.existsSync(csvPath)) {
    logger.info(`Loading jobs from ${csvPath}`);
    const content = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true }) as Record<
      string,
      unknown
    >[];
    return records.map(normalizeJob);
  }

  logger.warn('No jobs data file found, returning empty array');
  return [];
}

export function loadCandidates(dataDir: string): Candidate[] {
  const jsonPath = path.join(dataDir, 'candidates.json');
  const csvPath = path.join(dataDir, 'candidates.csv');

  if (fs.existsSync(jsonPath)) {
    logger.info(`Loading candidates from ${jsonPath}`);
    const raw = JSON.parse(
      fs.readFileSync(jsonPath, 'utf-8'),
    ) as Record<string, unknown>[];
    return raw.map(normalizeCandidate);
  }

  if (fs.existsSync(csvPath)) {
    logger.info(`Loading candidates from ${csvPath}`);
    const content = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true }) as Record<
      string,
      unknown
    >[];
    return records.map(normalizeCandidate);
  }

  logger.warn('No candidates data file found, returning empty array');
  return [];
}
