import { requestJSON } from "./client";
import type {
  ClassResponse,
  GradeResponse,
  RankResponse,
} from "./types";

const encode = (value: string) => encodeURIComponent(value.trim());

export async function fetchGrades(
  params: { id: string; pwd: string; term?: string },
  baseUrl?: string,
) {
  const { id, pwd, term = "" } = params;
  const query = term ? `?term=${encode(term)}` : "";
  return requestJSON<GradeResponse>(
    `/jwc/${encode(id)}/${encode(pwd)}/grade${query}`,
    baseUrl,
  );
}

export async function fetchRank(
  params: { id: string; pwd: string },
  baseUrl?: string,
) {
  const { id, pwd } = params;
  return requestJSON<RankResponse>(
    `/jwc/${encode(id)}/${encode(pwd)}/rank`,
    baseUrl,
  );
}

export async function fetchClasses(
  params: { id: string; pwd: string; term: string; week: string },
  baseUrl?: string,
) {
  const { id, pwd, term, week } = params;
  return requestJSON<ClassResponse>(
    `/jwc/${encode(id)}/${encode(pwd)}/class/${encode(term)}/${encode(week)}`,
    baseUrl,
  );
}
