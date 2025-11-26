import express from "express";
import { classes, grade, rank } from "./jwc.js";
import { searchBus } from "./bus.js";

const app = express();
const PORT = process.env.PORT || 12000;

app.get("/", (_req, res) => {
  res.json({
    service: "CSU MCP (Node)",
    routes: [
      "/api/jwc/:id/:pwd/grade?term=xxx",
      "/api/jwc/:id/:pwd/rank",
      "/api/jwc/:id/:pwd/class/:term/:week",
      "/api/bus/:date/:startstation/:endstation/:starttimeleft/:starttimeright",
    ],
  });
});

app.get("/api/jwc/:id/:pwd/grade", async (req, res) => {
  try {
    const grades = await grade(
      { id: req.params.id, pwd: req.params.pwd },
      (req.query.term || "").toString(),
    );
    res.json({ StateCode: 1, Error: "", Grades: grades });
  } catch (error) {
    res.json({ StateCode: -1, Error: error.message, Grades: [] });
  }
});

app.get("/api/jwc/:id/:pwd/rank", async (req, res) => {
  try {
    const ranks = await rank({ id: req.params.id, pwd: req.params.pwd });
    res.json({ StateCode: 1, Error: "", Rank: ranks });
  } catch (error) {
    res.json({ StateCode: -1, Error: error.message, Rank: [] });
  }
});

app.get("/api/jwc/:id/:pwd/class/:term/:week", async (req, res) => {
  try {
    const { classes: cls, startWeekDay } = await classes(
      { id: req.params.id, pwd: req.params.pwd },
      req.params.term,
      req.params.week,
    );
    res.json({
      StateCode: 1,
      Error: "",
      Class: cls,
      StartWeekDay: startWeekDay,
    });
  } catch (error) {
    res.json({ StateCode: -1, Error: error.message, Class: [], StartWeekDay: "" });
  }
});

app.get(
  "/api/bus/:date/:startstation/:endstation/:starttimeleft/:starttimeright",
  async (req, res) => {
    try {
      const buses = await searchBus({
        date: req.params.date,
        startStation: req.params.startstation,
        endStation: req.params.endstation,
        startTimeLeft: req.params.starttimeleft,
        startTimeRight: req.params.starttimeright,
      });
      res.json({ StateCode: 1, Err: "", Buses: buses });
    } catch (error) {
      res.json({ StateCode: -1, Err: error.message, Buses: [] });
    }
  },
);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Node API listening on :${PORT}`);
});
