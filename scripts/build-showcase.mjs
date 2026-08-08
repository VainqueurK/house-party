import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url).pathname;
const artifact = `${root}artifacts`;
const showcase = `${artifact}/showcase`;
const cardSources = `${root}showcase/cards`;
const cards = `${showcase}/cards`;
const raw = `${showcase}/raw`;

mkdirSync(raw, { recursive: true });
mkdirSync(cards, { recursive: true });

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error?.code === "ENOENT")
    throw new Error(`${command} is required to build the acceptance reel.`);
  if (result.status !== 0)
    throw new Error(`${command} exited with status ${result.status}.`);
}

for (const card of [
  "title",
  "transition",
  "outro",
  "mobile-badge",
  "finale-badge",
])
  run("rsvg-convert", [
    "-o",
    `${cards}/${card}.png`,
    `${cardSources}/${card}.svg`,
  ]);

run("ffmpeg", [
  "-y",
  "-i",
  `${raw}/mobile.webm`,
  "-loop",
  "1",
  "-i",
  `${cards}/mobile-badge.png`,
  "-filter_complex",
  "[0:v]fps=30,split=2[bg0][phone0];[bg0]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,boxblur=24:8,eq=brightness=-0.34:saturation=0.7[bg];[phone0]scale=314:680,setsar=1,pad=330:696:(ow-iw)/2:8:color=0xFFF4E4[phone];[bg][phone]overlay=x=(W-w)/2:y=12:shortest=1[tmp];[tmp][1:v]overlay=x=(W-w)/2:y=676:shortest=1,setsar=1[out]",
  "-map",
  "[out]",
  "-c:v",
  "libx264",
  "-preset",
  "fast",
  "-crf",
  "20",
  "-pix_fmt",
  "yuv420p",
  `${showcase}/chapter1.mp4`,
]);

run("ffmpeg", [
  "-y",
  "-i",
  `${raw}/final-chapter.webm`,
  "-loop",
  "1",
  "-i",
  `${cards}/finale-badge.png`,
  "-filter_complex",
  "[0:v]fps=30,scale=1280:720,setsar=1[base];[base][1:v]overlay=x=24:y=92:shortest=1,setsar=1[out]",
  "-map",
  "[out]",
  "-c:v",
  "libx264",
  "-preset",
  "fast",
  "-crf",
  "20",
  "-pix_fmt",
  "yuv420p",
  `${showcase}/chapter2.mp4`,
]);

run("ffmpeg", [
  "-y",
  "-loop",
  "1",
  "-t",
  "4",
  "-i",
  `${cards}/title.png`,
  "-i",
  `${showcase}/chapter1.mp4`,
  "-loop",
  "1",
  "-t",
  "3",
  "-i",
  `${cards}/transition.png`,
  "-i",
  `${showcase}/chapter2.mp4`,
  "-loop",
  "1",
  "-t",
  "4",
  "-i",
  `${cards}/outro.png`,
  "-filter_complex",
  "[0:v]fps=30,trim=duration=4,setpts=PTS-STARTPTS,setsar=1,format=yuv420p[v0];[1:v]fps=30,setpts=PTS-STARTPTS,setsar=1,format=yuv420p[v1];[2:v]fps=30,trim=duration=3,setpts=PTS-STARTPTS,setsar=1,format=yuv420p[v2];[3:v]fps=30,setpts=PTS-STARTPTS,setsar=1,format=yuv420p[v3];[4:v]fps=30,trim=duration=4,setpts=PTS-STARTPTS,setsar=1,format=yuv420p[v4];[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0[outv]",
  "-map",
  "[outv]",
  "-c:v",
  "libx264",
  "-preset",
  "medium",
  "-crf",
  "20",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  `${artifact}/palermo-acceptance-reel.mp4`,
]);

console.log(`Acceptance reel: ${artifact}/palermo-acceptance-reel.mp4`);
