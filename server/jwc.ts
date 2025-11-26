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

export const grade = async (user: JwcUser, term = "") => {
  const body = new URLSearchParams();
  body.set("xnxq01id", term);

  const resp = await authenticatedRequest(user.id, user.pwd, "POST", JWC_GRADE_URL, body);
  const html = await resp.text();
  if (!html.includes("学生个人考试成绩")) {
    throw new Error("教务系统异常或账号密码错误");
  }
  const $ = loadHTML(html);
  const grades = [];
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
  return grades;
};

export const rank = async (user: JwcUser) => {
  const sessionFetch = await login(user.id, user.pwd);
  const resp = await sessionFetch(JWC_RANK_URL, { method: "GET" });
  const html = await resp.text();
  const $ = loadHTML(html);

  const terms: string[] = [];
  $("#xqfw option").each((_, el) => {
    terms.push($(el).text());
  });
  const results: RankEntry[] = [];

  for (const term of terms) {
    const form = new URLSearchParams();
    form.set("xqfw", term);
    const termResp = await sessionFetch(JWC_RANK_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const termHtml = await termResp.text();
    const $$ = loadHTML(termHtml);
    const td = $$("#dataList tr").eq(1).find("td");
    results.push({
      Term: term,
      TotalScore: td.eq(1).text(),
      ClassRank: td.eq(2).text(),
      AverScore: td.eq(3).text(),
    });
  }

  return results;
};

export const classes = async (user: JwcUser, term: string, week: string) => {
  const form = new URLSearchParams();
  form.set("zc", week === "0" ? "" : week);
  form.set("xnxq01id", term);
  form.set("sfFD", "1");

  const resp = await authenticatedRequest(
    user.id,
    user.pwd,
    "POST",
    JWC_CLASS_URL,
    form,
  );
  const html = await resp.text();
  const $ = loadHTML(html);

  const classesMatrix: ClassEntry[][] = [];
  $("table#kbtable")
    .eq(0)
    .find("tr")
    .each((_, row) => {
      const timeInDay = $(row).find("th").eq(0).text().trim().replace(/\u00a0/g, "");
      $(row)
        .find("td")
        .each((colIdx, cell) => {
          const timeInWeek = String(colIdx + 1);
          const font = $(cell).find("div.kbcontent font");
          const className = $(cell).contents().first().text() || "";
          if (font.length === 3) {
            classesMatrix.push([
              {
                ClassName: className,
                Teacher: font.eq(0).text(),
                Weeks: font.eq(1).text(),
                Place: font.eq(2).text(),
                TimeInWeek: timeInWeek,
                TimeInDay: timeInDay,
              },
            ]);
          } else if (font.length === 6) {
            classesMatrix.push([
              {
                ClassName: className,
                Teacher: font.eq(0).text(),
                Weeks: font.eq(1).text(),
                Place: font.eq(2).text(),
                TimeInWeek: timeInWeek,
                TimeInDay: timeInDay,
              },
              {
                ClassName: font.eq(3).prev()?.prev()?.text() || "",
                Teacher: font.eq(3).text(),
                Weeks: font.eq(4).text(),
                Place: font.eq(5).text(),
                TimeInWeek: timeInWeek,
                TimeInDay: timeInDay,
              },
            ]);
          } else {
            classesMatrix.push([]);
          }
        });
    });

  const info = $("table#kbtable").eq(1).find("td").eq(0).text();
  const match = /第1周\u00a0(.*)日至/.exec(info);
  const startWeekDay = match?.[1] || "";

  return { classes: classesMatrix, startWeekDay };
};
