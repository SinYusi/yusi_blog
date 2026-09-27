// src/app/globals.css의 색 토큰을 읽어, 실제로 함께 쓰는 글자·배경 조합이 WCAG AA(4.5:1)를 만족하는지 검사합니다.
import { readFileSync } from "node:fs";

const MIN_RATIO = 4.5;
const REQUIRED_THEMES = ["dark", "light"];
const CSS_PATH = new URL("../src/app/globals.css", import.meta.url);

// [글자 토큰, 배경 토큰들]
const PAIRS = [
  ["fg", ["bg", "surface", "code"]],
  ["fg-secondary", ["bg", "surface"]],
  ["fg-article", ["bg", "surface"]],
  ["muted", ["bg", "surface", "code", "border"]],
  ["accent", ["bg", "surface", "code"]],
  ["accent-hover", ["bg", "surface"]],
  ["date", ["bg", "surface"]],
  ["danger", ["bg", "surface", "code"]],
  ["success", ["bg", "surface"]],
  ["bg", ["accent"]], // 주요 버튼: accent 바탕 위 글자
];

function readThemes(css) {
  const themes = {};
  for (const [, name, body] of css.matchAll(/\[data-theme="(\w+)"\]\s*\{([^}]*)\}/g)) {
    themes[name] = Object.fromEntries(
      [...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(([, key, value]) => [
        key,
        value,
      ]),
    );
  }
  return themes;
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const themes = readThemes(readFileSync(CSS_PATH, "utf8"));
const missingThemes = REQUIRED_THEMES.filter((name) => !themes[name]);
if (missingThemes.length > 0) {
  console.error(`globals.css에 테마 블록이 없습니다: ${missingThemes.join(", ")}`);
  process.exit(1);
}
const themeNames = Object.keys(themes);

let failures = 0;
for (const theme of themeNames) {
  const colors = themes[theme];
  let lowest = { ratio: Infinity };
  for (const [fg, backgrounds] of PAIRS) {
    for (const bg of backgrounds) {
      if (!colors[fg] || !colors[bg]) {
        console.error(`✗ ${theme}: 토큰이 없습니다 (${!colors[fg] ? fg : bg})`);
        failures++;
        continue;
      }
      const ratio = contrast(colors[fg], colors[bg]);
      if (ratio < lowest.ratio) lowest = { ratio, fg, bg };
      if (ratio < MIN_RATIO) {
        console.error(`✗ ${theme}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1 (기준 ${MIN_RATIO}:1)`);
        failures++;
      }
    }
  }
  console.log(
    `${theme}: 가장 낮은 조합 ${lowest.fg} on ${lowest.bg} = ${lowest.ratio.toFixed(2)}:1`,
  );
}

if (failures > 0) {
  console.error(`색 대비 검사 실패: ${failures}건`);
  process.exit(1);
}
console.log("색 대비 검사 통과");
