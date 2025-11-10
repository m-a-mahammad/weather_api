import "dotenv/config";
import express from "express";
import axios from "axios";
import type { Request, Response } from "express";
import { createClient } from "redis";

const app = express();
app.set("view engine", "ejs");
app.set("views", "src/views");

const redisClient = await createClient()
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();
const DEFAULT_EXPIRATION = 3600;

app.get("/", (req: Request, res: Response) => {
  res.redirect("/weather");
});

app.get("/weather", async (req: Request, res: Response) => {
  const city = req.query.city ?? "Giza";
  const units = req.query.units ?? process.env.C_TEMP;
  const apiKey = process.env.OPEN_WEATHER_SECRET;
  const apiUrl = "https://api.openweathermap.org/data/2.5/weather";
  try {
    const data = await getOrSetCache(
      `weather?q=${city}&units=${process.env.C_TEMP}`,
      async () => {
        const { data } = await axios.get(apiUrl, {
          params: {
            q: city,
            units,
            appid: apiKey,
          },
        });
        return data;
      }
    );
    res.render("home", { data: data });
  } catch (error) {
    console.error("Error fetching weather data:", error);
  }
});

function getOrSetCache(key: string, cb: () => Promise<any>) {
  return new Promise((resolve, reject) => {
    redisClient
      .get(key)
      .then(async (data) => {
        if (data != null) return resolve(JSON.parse(data));
        const freshData = await cb();
        redisClient.SETEX(key, DEFAULT_EXPIRATION, JSON.stringify(freshData));
        resolve(freshData);
      })
      .catch(async (err) => {
        reject(err);
      });
  });
}

app.listen(3000, () => {
  console.log("app is listening on port 3000");
});
