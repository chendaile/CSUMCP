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
export interface StudentCard {
    department: string;
    major: string;
    duration: string;
    className: string;
    studentId: string;
    name: string;
    gender: string;
    namePinyin: string;
    birthday: string;
    maritalStatus: string;
    phone: string;
    majorDirection: string;
    politicalStatus: string;
    birthplace: string;
    admissionMajor: string;
    ethnicity: string;
    studentType: string;
    educationLevel: string;
    admissionDate: string;
    address: string;
    arrivalStation: string;
    postalCode: string;
    idCard: string;
    examId: string;
    studyResume: {
        period: string;
        organization: string;
        education: string;
    }[];
    familyMembers: {
        name: string;
        relation: string;
        workplace: string;
        phone: string;
    }[];
    changes: {
        type: string;
        reason: string;
        date: string;
        originalDepartment: string;
        originalMajor: string;
        originalGrade: string;
    }[];
    disciplineCategory: string;
    graduationCertificate: string;
    bachelorCertificate: string;
    printDate: string;
}
export declare const grade: (user: JwcUser, term?: string) => Promise<JwcGrade[]>;
export declare const rank: (user: JwcUser) => Promise<RankEntry[]>;
export declare const classes: (user: JwcUser, term: string, week: string) => Promise<{
    classes: ClassEntry[][];
    startWeekDay: string;
}>;
export declare const levelExam: (user: JwcUser) => Promise<LevelExamEntry[]>;
export declare const studentPlan: (user: JwcUser) => Promise<StudentPlanEntry[]>;
export declare const studentInfo: (user: JwcUser) => Promise<StudentCard>;
export declare const minorInfo: (user: JwcUser) => Promise<{
    registrations: MinorRegistrationEntry[];
    payments: MinorPaymentEntry[];
}>;
