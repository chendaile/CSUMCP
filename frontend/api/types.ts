export interface ApiState {
  StateCode: number;
  Error?: string;
  Err?: string;
}

export interface JwcGrade {
  GottenTerm: string;
  ClassName: string;
  FinalGrade: string;
  Credit: string;
  ClassNature: string;
  ClassAttribute: string;
}

export interface Rank {
  Term: string;
  TotalScore: string;
  ClassRank: string;
  AverScore: string;
}

export interface ClassEntry {
  ClassName: string;
  Teacher: string;
  Weeks: string;
  Place: string;
  TimeInWeek: string;
  TimeInDay: string;
}

export interface Bus {
  StartTime: string;
  Station: string[];
}

export interface GradeResponse extends ApiState {
  Grades: JwcGrade[];
}

export interface RankResponse extends ApiState {
  Rank: Rank[];
}

export interface ClassResponse extends ApiState {
  Class: ClassEntry[][];
  StartWeekDay: string;
}

export interface BusResponse {
  StateCode: number;
  Err?: string;
  Buses: Bus[];
}
