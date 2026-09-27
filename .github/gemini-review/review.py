"""Gemini API로 PR을 리뷰하고 GitHub PR 리뷰로 게시합니다.

모델에게 도구 호출을 맡기지 않고, 이 스크립트가 diff 수집과 리뷰 게시를 직접 처리합니다.
모델은 구조화된 JSON(요약 + 인라인 코멘트)만 반환하므로 리뷰 1건에 API 요청 1회만 사용합니다.

환경 변수
- GEMINI_API_KEY: Google AI Studio API 키 (필수)
- GEMINI_MODEL: 사용할 모델 (기본값 DEFAULT_MODEL)
- REPOSITORY: owner/repo
- PULL_REQUEST_NUMBER: PR 번호
- ADDITIONAL_CONTEXT: 코멘트로 전달된 추가 요청 (선택)
"""

import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_MODEL = "gemini-3.5-flash-lite"
IGNORED_FILES = {"pnpm-lock.yaml", "next-env.d.ts"}
MAX_DIFF_CHARS = 200_000
PROMPT_PATH = Path(__file__).with_name("prompt.md")

SEVERITY_LABELS = {
    "critical": "🔴 Critical",
    "high": "🟠 High",
    "medium": "🟡 Medium",
    "low": "🟢 Low",
}

RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "summary": {"type": "STRING"},
        "comments": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "path": {"type": "STRING"},
                    "line": {"type": "INTEGER"},
                    "side": {"type": "STRING", "enum": ["RIGHT", "LEFT"]},
                    "severity": {"type": "STRING", "enum": list(SEVERITY_LABELS)},
                    "body": {"type": "STRING"},
                    "suggestion": {"type": "STRING"},
                },
                "required": ["path", "line", "side", "severity", "body"],
            },
        },
    },
    "required": ["summary", "comments"],
}


def gh(*args: str, input_data: str | None = None) -> str:
    result = subprocess.run(
        ["gh", *args], input=input_data, capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        sys.exit(f"gh {' '.join(args[:2])} 실패: {result.stderr.strip()}")
    return result.stdout


def split_diff(diff: str) -> dict[str, str]:
    """전체 diff를 파일 경로별 diff로 나눕니다."""
    files: dict[str, str] = {}
    for chunk in re.split(r"(?m)^(?=diff --git )", diff):
        match = re.match(r"diff --git a/(.+?) b/(.+)", chunk)
        if match:
            files[match.group(2)] = chunk
    return files


def commentable_lines(file_diff: str) -> dict[str, set[int]]:
    """GitHub가 리뷰 코멘트를 허용하는 줄(hunk 안의 줄)을 side별로 계산합니다."""
    lines: dict[str, set[int]] = {"LEFT": set(), "RIGHT": set()}
    old = new = 0
    in_hunk = False
    for raw in file_diff.splitlines():
        header = re.match(r"@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@", raw)
        if header:
            old, new = int(header.group(1)), int(header.group(2))
            in_hunk = True
            continue
        if not in_hunk or raw.startswith("\\"):
            continue
        if raw.startswith("+"):
            lines["RIGHT"].add(new)
            new += 1
        elif raw.startswith("-"):
            lines["LEFT"].add(old)
            old += 1
        else:
            lines["RIGHT"].add(new)
            lines["LEFT"].add(old)
            old += 1
            new += 1
    return lines


def call_gemini(model: str, api_key: str, system_prompt: str, user_prompt: str) -> dict:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": RESPONSE_SCHEMA,
        },
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
    )
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            body = json.load(response)
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")
        hint = " (무료 사용량 초과일 수 있습니다)" if error.code == 429 else ""
        sys.exit(f"Gemini API 오류 {error.code}{hint}: {detail[:2000]}")

    candidate = (body.get("candidates") or [{}])[0]
    parts = candidate.get("content", {}).get("parts", [])
    text = "".join(part.get("text", "") for part in parts)
    if not text:
        sys.exit(f"Gemini 응답이 비어 있습니다: {json.dumps(body, ensure_ascii=False)[:2000]}")
    return json.loads(text)


def format_comment(comment: dict) -> str:
    label = SEVERITY_LABELS.get(comment.get("severity", ""), "")
    text = f"**{label}** {comment['body']}".strip()
    suggestion = (comment.get("suggestion") or "").rstrip("\n")
    if suggestion and comment.get("side") == "RIGHT":
        text += f"\n\n```suggestion\n{suggestion}\n```"
    return text


def main() -> None:
    repository = os.environ["REPOSITORY"]
    pr_number = os.environ["PULL_REQUEST_NUMBER"]
    model = os.environ.get("GEMINI_MODEL") or DEFAULT_MODEL
    extra = os.environ.get("ADDITIONAL_CONTEXT", "").strip()

    pr = json.loads(
        gh("pr", "view", pr_number, "--repo", repository, "--json", "title,body,headRefOid")
    )
    files = {
        path: chunk
        for path, chunk in split_diff(gh("pr", "diff", pr_number, "--repo", repository)).items()
        if Path(path).name not in IGNORED_FILES
    }
    if not files:
        print("리뷰할 파일이 없습니다.")
        return

    diff_text = "".join(files.values())
    truncated = len(diff_text) > MAX_DIFF_CHARS
    diff_text = diff_text[:MAX_DIFF_CHARS]

    user_prompt = "\n\n".join(
        [
            f"# PR 제목\n{pr['title']}",
            f"# PR 설명\n{pr.get('body') or '(없음)'}",
            f"# 추가 요청\n{extra or '(없음)'}",
            f"# Diff{' (길이 제한으로 일부 생략)' if truncated else ''}\n```diff\n{diff_text}\n```",
        ]
    )
    result = call_gemini(
        model, os.environ["GEMINI_API_KEY"], PROMPT_PATH.read_text(), user_prompt
    )

    allowed = {path: commentable_lines(chunk) for path, chunk in files.items()}
    inline, misplaced = [], []
    for comment in result.get("comments", []):
        side = comment.get("side", "RIGHT")
        if comment.get("line") in allowed.get(comment.get("path"), {}).get(side, set()):
            inline.append(
                {
                    "path": comment["path"],
                    "line": comment["line"],
                    "side": side,
                    "body": format_comment(comment),
                }
            )
        else:
            misplaced.append(comment)

    body = f"## 🤖 Gemini 리뷰\n\n{result.get('summary', '').strip()}"
    if misplaced:
        body += "\n\n### 줄 위치를 확인하지 못한 코멘트\n"
        for comment in misplaced:
            body += f"\n- `{comment.get('path')}:{comment.get('line')}` {format_comment(comment)}"
    if truncated:
        body += "\n\n> diff가 길어 일부만 리뷰했습니다."
    body += f"\n\n<sub>model: `{model}`</sub>"

    review = {
        "commit_id": pr["headRefOid"],
        "event": "COMMENT",
        "body": body,
        "comments": inline,
    }
    gh(
        "api",
        f"repos/{repository}/pulls/{pr_number}/reviews",
        "--method",
        "POST",
        "--input",
        "-",
        input_data=json.dumps(review),
    )
    print(f"리뷰 게시 완료: 인라인 {len(inline)}건, 위치 미확인 {len(misplaced)}건")


if __name__ == "__main__":
    main()
