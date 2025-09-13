import express from "express";
import { spawn } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { mkdir, rm } from "fs/promises";

const app = express();

app.get("/stream", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send("Missing ?url param");

  // Temporary folder for this stream
  const id = Date.now().toString();
  const outDir = join(tmpdir(), id);
  await mkdir(outDir);

  console.log("Starting ffmpeg for:", url);

  // ffmpeg command with all fixes
  const ffmpeg = spawn("ffmpeg", [
    "-i", url,
    "-c:v", "copy",
    "-c:a", "aac", "-b:a", "192k", "-ac", "2",
    "-scodec", "webvtt",
    "-hls_playlist_type", "vod",
    "-hls_time", "6",
    join(outDir, "index.m3u8")
  ]);

  ffmpeg.stderr.on("data", data => console.log(data.toString()));

  ffmpeg.on("close", code => console.log("FFmpeg exited with code", code));

  // Wait a few seconds to generate initial segments before redirect
  setTimeout(() => {
    res.redirect(`/hls/${id}/index.m3u8`);
  }, 5000);
});

// Serve HLS output
app.use("/hls", express.static(tmpdir()));

// Cleanup old streams every hour
setInterval(async () => {
  try {
    await rm(tmpdir(), { recursive: true, force: true });
  } catch (e) {
    console.error("Cleanup error:", e);
  }
}, 3600000);

app.listen(3000, () => console.log("Server running on port 3000"));
