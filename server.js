import express from "express";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const app = express();
const PORT = process.env.PORT || 3000;
const BASE = path.join(os.tmpdir(), "mkv-hls");
if (!fs.existsSync(BASE)) fs.mkdirSync(BASE, { recursive: true });

function genId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2,8);
}

app.get("/stream", async (req, res) => {
  const mkvUrl = req.query.url;
  if (!mkvUrl) return res.status(400).send("Missing url parameter");

  const id = genId();
  const dir = path.join(BASE, id);
  fs.mkdirSync(dir, { recursive: true });

  const playlist = path.join(dir, "index.m3u8");
  const segmentPattern = path.join(dir, "segment-%05d.ts");

  const args = [
    "-y",
    "-i", mkvUrl,
    "-map", "0",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "128k",
    "-c:s", "webvtt",
    "-f", "hls",
    "-hls_time", "6",
    "-hls_list_size", "0",
    "-hls_segment_filename", segmentPattern,
    playlist
  ];

  const ff = spawn("ffmpeg", args);
  ff.stderr.on("data", d => console.log(d.toString()));

  const waitForFile = () => new Promise(resolve => {
    const start = Date.now();
    const iv = setInterval(() => {
      if (fs.existsSync(playlist)) { clearInterval(iv); resolve(true); }
      if (Date.now() - start > 10000) { clearInterval(iv); resolve(false); }
    }, 300);
  });

  const ok = await waitForFile();
  if (!ok) return res.status(500).send("Failed to create playlist");

  const host = req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  res.redirect(`${proto}://${host}/hls/${id}/index.m3u8`);
});

app.use("/hls", express.static(BASE));

app.listen(PORT, () => console.log(`Listening on ${PORT}`));
