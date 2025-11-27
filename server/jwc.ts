import { load as loadHTML } from "cheerio";
import { authenticatedRequest, login } from "./auth.js";

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

const JWC_BASE_URL = "http://csujwc.its.csu.edu.cn/jsxsd/";
const JWC_GRADE_URL = `${JWC_BASE_URL}kscj/yscjcx_list`;
const JWC_RANK_URL = `${JWC_BASE_URL}kscj/zybm_cx`;
const JWC_CLASS_URL = `${JWC_BASE_URL}xskb/xskb_list.do`;

const debug = (...args: unknown[]) => {
        console.log(new Date().toISOString(), "[jwc]", ...args);
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
                                        const visibleBlocks = $(cell).find(
                                                "div.kbcontent1"
                                        );
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
                                                const metaBlock =
                                                        baseId
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
                                                const className = (metaBlock.length > 0
                                                        ? metaBlock
                                                        : $block)
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
                                                const getByTitle = (keyword: string) =>
                                                        fonts
                                                                .filter((_, f) =>
                                                                        ($(f)
                                                                                .attr(
                                                                                        "title"
                                                                                ) || ""
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
