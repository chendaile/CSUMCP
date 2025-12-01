import { load as loadHTML } from "cheerio";
import { authenticatedRequest, login } from "./auth.js";
import { logger } from "../logger.js";

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
        studyResume: { period: string; organization: string; education: string }[];
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

const JWC_BASE_URL = "http://csujwc.its.csu.edu.cn/jsxsd/";
const JWC_GRADE_URL = `${JWC_BASE_URL}kscj/yscjcx_list`;
const JWC_RANK_URL = `${JWC_BASE_URL}kscj/zybm_cx`;
const JWC_CLASS_URL = `${JWC_BASE_URL}xskb/xskb_list.do`;
const JWC_LEVEL_EXAM_URL = `${JWC_BASE_URL}kscj/djkscj_list`;
const JWC_STUDENT_INFO_PAGE_URL = `${JWC_BASE_URL}grxx/xsxx`;
const JWC_MINOR_REG_URL = `${JWC_BASE_URL}fxgl/fxbmxx`;
const JWC_MINOR_PAY_URL = `${JWC_BASE_URL}fxgl/fxxkjf_query`;
const JWC_BASE_HOST = "http://csujwc.its.csu.edu.cn";
const JWC_STUDENT_PLAN_URL = `${JWC_BASE_URL}pyfa/pyfa_query`;

const debug = (...args: unknown[]) => {
        logger.info("[jwc]", ...args);
};

export const grade = async (user: JwcUser, term = "") => {
        debug("grade start", { id: user.id, term });
        const body = new URLSearchParams();
        body.set("xnxq01id", term);

        const resp = await authenticatedRequest(
                user.id,
                user.pwd,
                "POST",
                JWC_GRADE_URL,
                body
        );
        debug("grade response status", resp.status, "url", resp.url);
        const html = await resp.text();
        debug("grade page length", html.length, "term", term);
        if (!html.includes("学生个人考试成绩")) {
                debug("grade page missing expected marker");
                throw new Error("教务系统异常或账号密码错误");
        }
        const $ = loadHTML(html);
        const grades: JwcGrade[] = [];
        $("table#dataList tr").each((i, el) => {
                if (i === 0) return;
                const tds = $(el).find("td");
                const className = tds.eq(4).text();
                grades.push({
                        GottenTerm: tds.eq(3).text(),
                        ClassName: className,
                        FinalGrade: tds.eq(5).text(),
                        Credit: tds.eq(6).text(),
                        ClassAttribute: tds.eq(7).text(),
                        ClassNature: tds.eq(8).text(),
                });
        });
        debug("grade parsed count", grades.length);
        return grades;
};

export const rank = async (user: JwcUser) => {
        debug("rank start", { id: user.id });
        const { sessionFetch, jar } = await login(user.id, user.pwd);

        // 打印登录后的 cookies
        const cookiesBeforeRequest = jar.toJSON();
        if (cookiesBeforeRequest) {
                debug(
                        "rank cookies before request:",
                        JSON.stringify(
                                cookiesBeforeRequest.cookies.map((c: any) => ({
                                        key: c.key,
                                        domain: c.domain,
                                        path: c.path,
                                }))
                        )
                );
        }

        const resp = await sessionFetch(JWC_RANK_URL, { method: "GET" });
        debug("rank first page status", resp.status, "url", resp.url);
        const html = await resp.text();
        debug("rank first page length", html.length);
        debug("rank html preview:", html.substring(0, 2000));

        const $ = loadHTML(html);

        // 添加调试信息：尝试不同的选择器
        const selectByName = $("select[name='xqfw']");
        debug("rank select by name found:", selectByName.length);

        const selectById = $("#xqfw");
        debug("rank select by id found:", selectById.length);

        const allSelects = $("select");
        debug("rank all selects found:", allSelects.length);

        const allOptions = $("option");
        debug("rank all options found:", allOptions.length);

        const terms: string[] = [];
        // 尝试使用 select[name='xqfw'] option 选择器
        $("select[name='xqfw'] option").each((_, el) => {
                const text = $(el).text().trim();
                debug("rank found term:", text);
                terms.push(text);
        });
        debug("rank terms detected", terms);
        const results: RankEntry[] = [];

        for (const term of terms) {
                const form = new URLSearchParams();
                form.set("xqfw", term);
                debug("rank fetching term", term);
                const termResp = await sessionFetch(JWC_RANK_URL, {
                        method: "POST",
                        headers: {
                                "content-type":
                                        "application/x-www-form-urlencoded",
                        },
                        body: form,
                });
                debug(
                        "rank term status",
                        term,
                        termResp.status,
                        "url",
                        termResp.url
                );
                const termHtml = await termResp.text();
                debug("rank term page length", term, termHtml.length);
                const $$ = loadHTML(termHtml);
                const td = $$("#dataList tr").eq(1).find("td");
                results.push({
                        Term: term,
                        TotalScore: td.eq(1).text(),
                        ClassRank: td.eq(2).text(),
                        AverScore: td.eq(3).text(),
                });
        }

        debug("rank parsed count", results.length);
        return results;
};

export const classes = async (user: JwcUser, term: string, week: string) => {
        debug("classes start", { id: user.id, term, week });
        const form = new URLSearchParams();
        form.set("zc", week === "0" ? "" : week);
        form.set("xnxq01id", term);
        form.set("sfFD", "1");

        const resp = await authenticatedRequest(
                user.id,
                user.pwd,
                "POST",
                JWC_CLASS_URL,
                form
        );
        debug("classes response status", resp.status, "url", resp.url);
        const html = await resp.text();
        debug("classes page length", html.length, "term", term, "week", week);
        const $ = loadHTML(html);

        const classesMatrix: ClassEntry[][] = [];
        $("table#kbtable")
                .eq(0)
                .find("tr")
                .each((_, row) => {
                        const timeInDay = $(row)
                                .find("th")
                                .eq(0)
                                .text()
                                .trim()
                                .replace(/\u00a0/g, "");
                        $(row)
                                .find("td")
                                .each((colIdx, cell) => {
                                        const timeInWeek = String(colIdx + 1);
                                        const cellClasses: ClassEntry[] = [];

                                        // 一般一个单元格有 kbcontent1 (显示) 与 kbcontent (隐藏教师信息) 成对出现。
                                        const visibleBlocks =
                                                $(cell).find("div.kbcontent1");
                                        const blockCandidates =
                                                visibleBlocks.length > 0
                                                        ? visibleBlocks
                                                        : $(cell).find(
                                                                  "div.kbcontent"
                                                          );

                                        blockCandidates.each((_, block) => {
                                                const $block = $(block);
                                                const baseId =
                                                        $block
                                                                .attr("id")
                                                                ?.replace(
                                                                        /-\d+$/,
                                                                        ""
                                                                ) || "";
                                                const metaBlock = baseId
                                                        ? $(cell)
                                                                  .find(
                                                                          `div[id^='${baseId}-'].kbcontent`
                                                                  )
                                                                  .first()
                                                        : $(cell)
                                                                  .find(
                                                                          "div.kbcontent"
                                                                  )
                                                                  .first();
                                                // 课程名从可见块或元数据块去掉 <font>/<br> 后的文本
                                                const className = (
                                                        metaBlock.length > 0
                                                                ? metaBlock
                                                                : $block
                                                )
                                                        .clone()
                                                        .children("font,br")
                                                        .remove()
                                                        .end()
                                                        .text()
                                                        .trim();
                                                const fonts = (
                                                        metaBlock.length > 0
                                                                ? metaBlock
                                                                : $block
                                                ).find("font");
                                                const getByTitle = (
                                                        keyword: string
                                                ) =>
                                                        fonts
                                                                .filter(
                                                                        (
                                                                                _,
                                                                                f
                                                                        ) =>
                                                                                (
                                                                                        $(
                                                                                                f
                                                                                        ).attr(
                                                                                                "title"
                                                                                        ) ||
                                                                                        ""
                                                                                ).includes(
                                                                                        keyword
                                                                                )
                                                                )
                                                                .first()
                                                                .text();
                                                const teacher =
                                                        getByTitle("老师") ||
                                                        fonts.eq(0).text();
                                                const weeks =
                                                        getByTitle("周次") ||
                                                        fonts.eq(1).text();
                                                const place =
                                                        getByTitle("教室") ||
                                                        fonts.eq(2).text();

                                                if (
                                                        className ||
                                                        teacher ||
                                                        weeks ||
                                                        place
                                                ) {
                                                        cellClasses.push({
                                                                ClassName: className,
                                                                Teacher: teacher,
                                                                Weeks: weeks,
                                                                Place: place,
                                                                TimeInWeek: timeInWeek,
                                                                TimeInDay: timeInDay,
                                                        });
                                                }
                                        });

                                        classesMatrix.push(cellClasses);
                                });
                });

        const info = $("table#kbtable").eq(1).find("td").eq(0).text();
        const match = /第1周\u00a0(.*)日至/.exec(info);
        const startWeekDay = match?.[1] || "";
        debug(
                "classes parsed matrix length",
                classesMatrix.length,
                "startWeekDay",
                startWeekDay
        );

        return { classes: classesMatrix, startWeekDay };
};

export const levelExam = async (user: JwcUser) => {
        debug("levelExam start", { id: user.id });

        const resp = await authenticatedRequest(
                user.id,
                user.pwd,
                "GET",
                JWC_LEVEL_EXAM_URL,
                undefined
        );
        debug("levelExam response status", resp.status, "url", resp.url);
        const html = await resp.text();
        debug("levelExam page length", html.length);

        if (!html.includes("等级考试成绩")) {
                debug("levelExam page missing expected marker");
                throw new Error("教务系统异常或账号密码错误");
        }

        const $ = loadHTML(html);
        const exams: LevelExamEntry[] = [];

        $("table#dataList tr").each((i, el) => {
                // 跳过表头（前两行）
                if (i < 2) return;

                const tds = $(el).find("td");
                if (tds.length < 9) return;

                exams.push({
                        Course: tds.eq(1).text().trim(),
                        WrittenScore: tds.eq(2).text().trim(),
                        ComputerScore: tds.eq(3).text().trim(),
                        TotalScore: tds.eq(4).text().trim(),
                        WrittenLevel: tds.eq(5).text().trim(),
                        ComputerLevel: tds.eq(6).text().trim(),
                        TotalLevel: tds.eq(7).text().trim(),
                        ExamDate: tds.eq(8).text().trim(),
                });
        });

        debug("levelExam parsed count", exams.length);
        return exams;
};

export const studentPlan = async (user: JwcUser) => {
        debug("studentPlan start", { id: user.id });
        const { sessionFetch } = await login(user.id, user.pwd);

        const resp = await sessionFetch(JWC_STUDENT_PLAN_URL, {
                method: "GET",
        });
        debug("studentPlan status", resp.status, "url", resp.url);
        const html = await resp.text();
        const $ = loadHTML(html);
        const plans: StudentPlanEntry[] = [];

        $("table#dataList tr").each((i, el) => {
                        if (i === 0) return;
                        const tds = $(el).find("td");
                        if (tds.length < 10) return;
                        plans.push({
                                Index: tds.eq(0).text().trim(),
                                Term: tds.eq(1).text().trim(),
                                CourseId: tds.eq(2).text().trim(),
                                CourseName: tds.eq(3).text().trim(),
                                Credit: tds.eq(4).text().trim(),
                                Hours: tds.eq(5).text().trim(),
                                ExamType: tds.eq(6).text().trim(),
                                CourseAttr: tds.eq(7).text().trim(),
                                IsExam: tds.eq(8).text().trim(),
                                AdjustReason: tds.eq(9).text().trim(),
                        });
        });

        debug("studentPlan parsed count", plans.length);
        return plans;
};

const _parseFilenameFromDisposition = (disposition: string | null) => {
        if (!disposition) return "";
        const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
        if (utf8Match?.[1]) {
                try {
                        return decodeURIComponent(utf8Match[1]);
                } catch {
                        // ignore decode failure
                }
        }
        const asciiMatch = /filename="?([^";]+)"?/i.exec(disposition);
        const asciiName = asciiMatch?.[1] ?? "";
        if (asciiName && /[^\x00-\x7f]/.test(asciiName)) {
                try {
                        // 处理服务端按 GBK 返回、被当作 ISO-8859-1 解析导致的乱码
                        const decoded = new TextDecoder("gbk").decode(
                                Buffer.from(asciiName, "binary")
                        );
                        if (decoded) return decoded;
                } catch {
                        // ignore decode failure
                }
        }
        return asciiName;
};

export const studentInfo = async (user: JwcUser) => {
        debug("studentInfo start", { id: user.id });

        const { sessionFetch } = await login(user.id, user.pwd);

        const resp = await sessionFetch(JWC_STUDENT_INFO_PAGE_URL, {
                method: "GET",
        });
        debug("studentInfo page status", resp.status, "url", resp.url);
        const html = await resp.text();
        const $ = loadHTML(html);
        const table = $("#xjkpTable");
        if (!table.length) {
                debug(
                        "studentInfo page missing expected table",
                        html.substring(0, 200)
                );
                throw new Error("无法找到学籍卡片信息");
        }

        const normalize = (text: string) =>
                text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

        const rows = table
                .find("tr")
                .toArray()
                .map((tr) =>
                        $(tr)
                                .find("td")
                                .toArray()
                                .map((td) => normalize($(td).text()))
                );

        const findRow = (matcher: (cells: string[]) => boolean) =>
                rows.find((cells) => matcher(cells)) ?? [];
        const findRowIndex = (matcher: (cells: string[]) => boolean) =>
                rows.findIndex((cells) => matcher(cells));

        const joinedRow = (cells: string[]) =>
                normalize(cells.join(" ").replace(/\s+/g, " "));
        const condensedRow = (cells: string[]) =>
                normalize(cells.join("")).replace(/\s+/g, "");

        const firstNonEmpty = (values: string[]) =>
                values.find((v) => v !== undefined && v !== "") ?? "";

        const baseInfoRow = findRow((cells) =>
                cells.some((c) => c.includes("院系："))
        );
        const baseInfoText = joinedRow(baseInfoRow);
        const matchDept = /院系：([^ \u3000]+)/.exec(baseInfoText);
        const matchMajor = /专业：([^ \u3000]+)/.exec(baseInfoText);
        const matchDuration = /学制：([^ \u3000]+)/.exec(baseInfoText);
        const matchClass = /班级：([^ \u3000]+)/.exec(baseInfoText);
        const matchSid = /学号：([^ \u3000]+)/.exec(baseInfoText);

        const nameRow = findRow((cells) => cells[0] === "姓名");
        const birthRow = findRow((cells) => cells[0] === "出生日期");
        const directionRow = findRow((cells) => cells[0] === "专业方向");
        const birthplaceRow = findRow((cells) => cells[0] === "生源地");
        const admissionMajorRow = findRow((cells) => cells[0] === "招生专业");
        const typeRow = findRow((cells) => cells[0] === "学生类别");
        const addressRow = findRow((cells) => cells[0] === "家庭现住址");
        const postalRow = findRow((cells) => cells[0] === "邮政编码");
        const certificateRow = findRow((cells) =>
                cells[0]?.includes("毕(结)业证书号")
        );
        const disciplineRow = findRow((cells) =>
                cells.some((c) => c.includes("学科门类"))
        );
        const printDateRow = findRow((cells) =>
                cells.some((c) => c.includes("打印日期"))
        );

        const info: StudentCard = {
                department: matchDept?.[1] ?? "",
                major: matchMajor?.[1] ?? "",
                duration: matchDuration?.[1] ?? "",
                className: matchClass?.[1] ?? "",
                studentId: matchSid?.[1] ?? "",
                name: nameRow[1] ?? "",
                gender: nameRow[3] ?? "",
                namePinyin: nameRow[5] ?? "",
                birthday: birthRow[1] ?? "",
                maritalStatus: birthRow[3] ?? "",
                phone: birthRow[5] ?? "",
                majorDirection: directionRow[1] ?? "",
                politicalStatus:
                        directionRow[3] ??
                        directionRow[4] ??
                        directionRow[directionRow.length - 1] ??
                        "",
                birthplace: birthplaceRow.slice(1).join("") ?? "",
                admissionMajor: admissionMajorRow[1] ?? "",
                ethnicity:
                        admissionMajorRow[admissionMajorRow.length - 1] ?? "",
                studentType: typeRow[1] ?? "",
                educationLevel: typeRow[3] ?? typeRow[4] ?? "",
                admissionDate: typeRow[typeRow.length - 1] ?? "",
                address: firstNonEmpty(addressRow.slice(1, addressRow.length - 1)),
                arrivalStation:
                        addressRow[addressRow.length - 1] ??
                        addressRow[addressRow.length - 2] ??
                        "",
                postalCode: postalRow[1] ?? "",
                idCard: postalRow[3] ?? "",
                examId: postalRow[postalRow.length - 1] ?? "",
                studyResume: [],
                familyMembers: [],
                changes: [],
                disciplineCategory:
                        disciplineRow
                                .find((c) => c.includes("学科门类"))
                                ?.replace(/^学科门类：?/, "") ?? "",
                graduationCertificate: certificateRow[1] ?? "",
                bachelorCertificate:
                        certificateRow[certificateRow.length - 1] ?? "",
                printDate:
                        printDateRow.find((c) => c.includes("打印日期")) ?? "",
        };

        const resumeHeaderIdx = findRowIndex((cells) =>
                cells.join("").includes("学习及工作简历")
        );
        const familyHeaderIdx = findRowIndex((cells) =>
                cells.join("").includes("家庭成员情况")
        );
        const changeHeaderIdx = findRowIndex((cells) =>
                cells.join("").includes("学籍变动情况")
        );
        const flowHeaderIdx = findRowIndex((cells) =>
                cells.join("").includes("大类分流")
        );

        const sectionRows = (startIdx: number, endIdx: number) => {
                if (startIdx < 0) return [] as string[][];
                return rows.slice(
                        startIdx + 2,
                        endIdx > -1 ? endIdx : undefined
                );
        };

        const findSection = (startMatcher: string, endMatcher: string) => {
                const startIdx = findRowIndex((cells) =>
                        condensedRow(cells).includes(startMatcher)
                );
                const endIdx = rows.findIndex(
                        (cells, idx) =>
                                idx > startIdx &&
                                condensedRow(cells).includes(endMatcher)
                );
                return sectionRows(startIdx, endIdx);
        };

        const cleanResumeRows = findSection(
                "学习及工作简历",
                "家庭成员情况"
        );
        cleanResumeRows.forEach((r) => {
                const parts = r.filter(Boolean);
                if (parts.length === 0) return;
                info.studyResume.push({
                        period: parts[0] ?? "",
                        organization: parts[1] ?? "",
                        education: parts[2] ?? "",
                });
        });

        const cleanFamilyRows = findSection("家庭成员情况", "学籍变动情况");
        cleanFamilyRows.forEach((r) => {
                const parts = r.filter(Boolean);
                if (parts.length === 0) return;
                info.familyMembers.push({
                        name: parts[0] ?? "",
                        relation: parts[1] ?? "",
                        workplace: parts[2] ?? "",
                        phone: parts[3] ?? "",
                });
        });

        const cleanChangeRows = findSection("学籍变动情况", "大类分流");
        cleanChangeRows.forEach((r) => {
                const parts = r.filter(Boolean);
                if (parts.length === 0) return;
                info.changes.push({
                        type: parts[0] ?? "",
                        reason: parts[1] ?? "",
                        date: parts[2] ?? "",
                        originalDepartment: parts[3] ?? "",
                        originalMajor: parts[4] ?? "",
                        originalGrade: parts[5] ?? "",
                });
        });

        debug("studentInfo parsed", {
                studyResume: info.studyResume.length,
                family: info.familyMembers.length,
                changes: info.changes.length,
        });
        return info;
};

export const minorInfo = async (user: JwcUser) => {
        debug("minorInfo start", { id: user.id });
        const { sessionFetch } = await login(user.id, user.pwd);

        // 辅修报名信息
        const regResp = await sessionFetch(JWC_MINOR_REG_URL, {
                method: "GET",
        });
        debug("minorInfo reg status", regResp.status, "url", regResp.url);
        const regHtml = await regResp.text();
        const $reg = loadHTML(regHtml);
        const registrations: MinorRegistrationEntry[] = [];
        const planCache: Record<string, MinorPlanEntry[]> = {};
        const planTasks: Promise<void>[] = [];

        const normalizePlanHref = (href: string) => {
                if (!href) return "";
                if (href.startsWith("javascript:")) {
                        const match = /openWindow\(['"]([^'"]+)/.exec(href);
                        if (match?.[1])
                                return new URL(
                                        match[1],
                                        JWC_BASE_HOST
                                ).toString();
                        return "";
                }
                return new URL(href, JWC_BASE_HOST).toString();
        };

        const fetchPlan = async (href: string): Promise<MinorPlanEntry[]> => {
                const normalized = normalizePlanHref(href.trim());
                if (!normalized) return [];
                // 避免重复请求同一培养方案
                if (planCache[normalized]) return planCache[normalized];
                const planResp = await sessionFetch(normalized, {
                        method: "GET",
                });
                debug(
                        "minorInfo plan status",
                        planResp.status,
                        "url",
                        planResp.url
                );
                const planHtml = await planResp.text();
                const $plan = loadHTML(planHtml);
                const entries: MinorPlanEntry[] = [];
                $plan("table#dataList tr").each((i, el) => {
                        if (i === 0) return;
                        const tds = $plan(el).find("td");
                        if (tds.length < 9) return;
                        entries.push({
                                Index: tds.eq(0).text().trim(),
                                Term: tds.eq(1).text().trim(),
                                CourseId: tds.eq(2).text().trim(),
                                CourseName: tds.eq(3).text().trim(),
                                Credit: tds.eq(4).text().trim(),
                                Hours: tds.eq(5).text().trim(),
                                ExamType: tds.eq(6).text().trim(),
                                CourseAttr: tds.eq(7).text().trim(),
                                IsExam: tds.eq(8).text().trim(),
                        });
                });
                planCache[normalized] = entries;
                return entries;
        };

        $reg(".Nsb_r_list tr").each((i, el) => {
                if (i === 0) return; // header
                const tds = $reg(el).find("td");
                if (tds.length < 6) return;
                const planLink = $reg(tds.eq(5)).find("a").attr("href") ?? "";
                registrations.push({
                        Index: tds.eq(0).text().trim(),
                        Major: tds.eq(1).text().trim(),
                        Department: tds.eq(2).text().trim(),
                        Type: tds.eq(3).text().trim(),
                        Status: tds.eq(4).text().trim(),
                        Plan: [],
                });
                const last = registrations[registrations.length - 1];
                // 异步串行获取培养方案，保证同一 session
                planTasks.push(
                        fetchPlan(planLink.trim()).then((plan) => {
                                last.Plan = plan;
                        })
                );
        });

        // 辅修选课缴费
        const payResp = await sessionFetch(JWC_MINOR_PAY_URL, {
                method: "GET",
        });
        debug("minorInfo pay status", payResp.status, "url", payResp.url);
        const payHtml = await payResp.text();
        const $pay = loadHTML(payHtml);
        const payments: MinorPaymentEntry[] = [];
        $pay(".Nsb_r_list tr").each((i, el) => {
                if (i === 0) return; // header
                const tds = $pay(el).find("td");
                if (tds.length < 12) return;
                payments.push({
                        Index: tds.eq(0).text().trim(),
                        CourseId: tds.eq(1).text().trim(),
                        CourseName: tds.eq(2).text().trim(),
                        Department: tds.eq(3).text().trim(),
                        Class: tds.eq(4).text().trim(),
                        Place: tds.eq(5).text().trim(),
                        Time: tds.eq(6).text().trim(),
                        Teacher: tds.eq(7).text().trim(),
                        Credit: tds.eq(8).text().trim(),
                        Hours: tds.eq(9).text().trim(),
                        Fee: tds.eq(10).text().trim(),
                        Paid: tds.eq(11).text().trim(),
                });
        });

        await Promise.all(planTasks);

        debug(
                "minorInfo parsed",
                "registrations",
                registrations.length,
                "payments",
                payments.length
        );

        return { registrations, payments };
};
