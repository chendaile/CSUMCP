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

const JWC_BASE_URL = "http://csujwc.its.csu.edu.cn/jsxsd/";
const JWC_GRADE_URL = `${JWC_BASE_URL}kscj/yscjcx_list`;
const JWC_RANK_URL = `${JWC_BASE_URL}kscj/zybm_cx`;
const JWC_CLASS_URL = `${JWC_BASE_URL}xskb/xskb_list.do`;
const JWC_LEVEL_EXAM_URL = `${JWC_BASE_URL}kscj/djkscj_list`;
const JWC_STUDENT_INFO_PAGE_URL = `${JWC_BASE_URL}grxx/xsxx`;
const JWC_STUDENT_INFO_EXPORT_URL = `${JWC_BASE_URL}grxx/xsxx_print.do`;
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

export const summaryMarkdown = async (user: JwcUser, term = "") => {
        debug("summaryMarkdown start", { id: user.id, term });
        const md: string[] = [];
        md.push("# 教务信息汇总");
        if (term) {
                md.push(`- 成绩学期: ${term}`);
        }
        md.push("");

        const [grades, ranks, levelExams, minor, plans] = await Promise.all([
                grade(user, term),
                rank(user),
                levelExam(user),
                minorInfo(user),
                studentPlan(user),
        ]);

        // 成绩
        md.push("## 成绩");
        if (grades.length === 0) {
                md.push("暂无成绩数据。");
        } else {
                md.push("| 学期 | 课程 | 成绩 | 学分 | 课程性质 | 课程属性 |");
                md.push("| --- | --- | --- | --- | --- | --- |");
                grades.forEach((g) =>
                        md.push(
                                `| ${g.GottenTerm} | ${g.ClassName} | ${g.FinalGrade} | ${g.Credit} | ${g.ClassNature} | ${g.ClassAttribute} |`
                        )
                );
        }
        md.push("");

        // 排名
        md.push("## 排名");
        if (ranks.length === 0) {
                md.push("暂无排名数据。");
        } else {
                md.push("| 学期 | 总评 | 班级排名 | 平均分 |");
                md.push("| --- | --- | --- | --- |");
                ranks.forEach((r) =>
                        md.push(
                                `| ${r.Term} | ${r.TotalScore} | ${r.ClassRank} | ${r.AverScore} |`
                        )
                );
        }
        md.push("");

        // 等级考试
        md.push("## 等级考试");
        if (levelExams.length === 0) {
                md.push("暂无等级考试数据。");
        } else {
                md.push(
                        "| 考试 | 笔试分 | 机试分 | 总分 | 笔试等级 | 机试等级 | 总等级 | 考试日期 |"
                );
                md.push(
                        "| --- | --- | --- | --- | --- | --- | --- | --- |"
                );
                levelExams.forEach((e) =>
                        md.push(
                                `| ${e.Course} | ${e.WrittenScore} | ${e.ComputerScore} | ${e.TotalScore} | ${e.WrittenLevel} | ${e.ComputerLevel} | ${e.TotalLevel} | ${e.ExamDate} |`
                        )
                );
        }
        md.push("");

        // 辅修报名与缴费
        md.push("## 辅修报名");
        if (minor.registrations.length === 0) {
                md.push("暂无辅修报名信息。");
        } else {
                minor.registrations.forEach((reg, idx) => {
                        md.push(
                                `### 辅修报名 ${idx + 1}: ${reg.Major} (${reg.Department})`
                        );
                        md.push(
                                `- 类型: ${reg.Type}  状态: ${reg.Status}`
                        );
                        if (reg.Plan.length === 0) {
                                md.push("- 培养方案: 暂无数据");
                        } else {
                                md.push(
                                        "| 序号 | 开课学期 | 课程编号 | 课程名称 | 学分 | 学时 | 考核方式 | 课程属性 | 是否考试 |"
                                );
                                md.push(
                                        "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"
                                );
                                reg.Plan.forEach((p) =>
                                        md.push(
                                                `| ${p.Index} | ${p.Term} | ${p.CourseId} | ${p.CourseName} | ${p.Credit} | ${p.Hours} | ${p.ExamType} | ${p.CourseAttr} | ${p.IsExam} |`
                                        )
                                );
                        }
                        md.push("");
                });
        }

        md.push("## 辅修选课缴费");
        if (minor.payments.length === 0) {
                md.push("暂无辅修缴费数据。");
        } else {
                md.push(
                        "| 序号 | 课程编号 | 课程名称 | 开课单位 | 上课班级 | 上课地点 | 上课时间 | 教师 | 学分 | 学时 | 金额 | 是否缴费 |"
                );
                md.push(
                        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"
                );
                minor.payments.forEach((p) =>
                        md.push(
                                `| ${p.Index} | ${p.CourseId} | ${p.CourseName} | ${p.Department} | ${p.Class} | ${p.Place} | ${p.Time} | ${p.Teacher} | ${p.Credit} | ${p.Hours} | ${p.Fee} | ${p.Paid} |`
                        )
                );
        }
        md.push("");

        // 执行计划 / 培养方案
        md.push("## 执行计划（培养方案）");
        if (plans.length === 0) {
                md.push("暂无执行计划数据。");
        } else {
                md.push(
                        "| 序号 | 开课学期 | 课程编号 | 课程名称 | 学分 | 总学时 | 考核方式 | 课程属性 | 是否考试 | 微调原因 |"
                );
                md.push(
                        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"
                );
                plans.forEach((p) =>
                        md.push(
                                `| ${p.Index} | ${p.Term} | ${p.CourseId} | ${p.CourseName} | ${p.Credit} | ${p.Hours} | ${p.ExamType} | ${p.CourseAttr} | ${p.IsExam} | ${p.AdjustReason} |`
                        )
                );
        }

        const result = md.join("\n");
        debug("summaryMarkdown generated length", result.length);
        return result;
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

        // 预热学籍信息页面以获取必要的上下文
        const preflight = await sessionFetch(JWC_STUDENT_INFO_PAGE_URL, {
                method: "GET",
        });
        debug(
                "studentInfo preflight status",
                preflight.status,
                "url",
                preflight.url
        );

        const resp = await sessionFetch(JWC_STUDENT_INFO_EXPORT_URL, {
                method: "POST",
                headers: {
                        "content-type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams(),
        });
        debug("studentInfo export status", resp.status, "url", resp.url);
        const contentType =
                resp.headers.get("content-type") || "application/msexcel";

        const buffer = await resp.arrayBuffer();
        // 为避免中文编码乱码，强制使用英文文件名
        const filename = `${user.id}-student-info.xls`;

        debug(
                "studentInfo file ready",
                "size",
                buffer.byteLength,
                "filename",
                filename
        );

        return {
                buffer: Buffer.from(buffer),
                filename,
                contentType,
                contentDisposition: `attachment; filename="${filename}"`,
        };
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
