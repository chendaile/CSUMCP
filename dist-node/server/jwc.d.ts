export interface JwcUser {
    id: string;
    pwd: string;
}
export interface JwcGrade {
    GottenTerm: string;
    ClassName: string;
    FinalGrade: string;
    Credit: string;
    ClassNature: string;
    ClassAttribute: string;
}
export interface RankEntry {
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
export interface LevelExamEntry {
    Course: string;
    WrittenScore: string;
    ComputerScore: string;
    TotalScore: string;
    WrittenLevel: string;
    ComputerLevel: string;
    TotalLevel: string;
    ExamDate: string;
}
export interface MinorRegistrationEntry {
    Index: string;
    Major: string;
    Department: string;
    Type: string;
    Status: string;
    Plan: MinorPlanEntry[];
}
export interface MinorPaymentEntry {
    Index: string;
    CourseId: string;
    CourseName: string;
    Department: string;
    Class: string;
    Place: string;
    Time: string;
    Teacher: string;
    Credit: string;
    Hours: string;
    Fee: string;
    Paid: string;
}
export interface MinorPlanEntry {
    Index: string;
    Term: string;
    CourseId: string;
    CourseName: string;
    Credit: string;
    Hours: string;
    ExamType: string;
    CourseAttr: string;
    IsExam: string;
}
export interface StudentPlanEntry {
    Index: string;
    Term: string;
    CourseId: string;
    CourseName: string;
    Credit: string;
    Hours: string;
    ExamType: string;
    CourseAttr: string;
    IsExam: string;
    AdjustReason: string;
}
export declare const grade: (user: JwcUser, term?: string) => Promise<JwcGrade[]>;
export declare const rank: (user: JwcUser) => Promise<RankEntry[]>;
export declare const classes: (user: JwcUser, term: string, week: string) => Promise<{
    classes: ClassEntry[][];
    startWeekDay: string;
}>;
export declare const levelExam: (user: JwcUser) => Promise<LevelExamEntry[]>;
export declare const studentPlan: (user: JwcUser) => Promise<StudentPlanEntry[]>;
export declare const summaryMarkdown: (user: JwcUser, term?: string) => Promise<string>;
export declare const studentInfo: (user: JwcUser) => Promise<{
    buffer: Buffer<ArrayBuffer>;
    filename: string;
    contentType: string;
    contentDisposition: string;
}>;
export declare const minorInfo: (user: JwcUser) => Promise<{
    registrations: MinorRegistrationEntry[];
    payments: MinorPaymentEntry[];
}>;
