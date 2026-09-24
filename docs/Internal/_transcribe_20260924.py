#!/usr/bin/env python3
"""One-shot transcription script for 20260924_100050_Export.MP3"""
import json
import re
import sys
from datetime import datetime
from pathlib import Path

from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parents[2]
MP3 = ROOT / "docs/Internal/assest/20260924_100050_Export.MP3"
OUT_JSON = ROOT / "docs/Internal/20260924_100050_transcript_raw.json"
OUT_MD = ROOT / "docs/Internal/20260924_100050_Full_English_Transcript.md"

CHAIN_FIXES = {
    "46 63": "4663",
    "42 161": "42161",
    "46 630": "46630",
    "zero dev": "ZeroDev",
    "zerodev": "ZeroDev",
    "exo mesh": "ExoMesh",
    "sliver vine": "SliverVine",
    "robin hood": "Robinhood",
    "arbit rum": "Arbitrum",
    "entry point": "EntryPoint",
    "user op": "UserOp",
    "user ops": "UserOps",
    "sha 256": "SHA-256",
    "eip 1193": "EIP-1193",
    "eip 5792": "EIP-5792",
    "erc 7540": "ERC-7540",
}


def fmt_ts(seconds: float) -> str:
    total = int(seconds)
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def cleanup_text(text: str) -> str:
    t = text.strip()
    if not t:
        return t
    t = re.sub(r"\s+", " ", t)
    for old, new in CHAIN_FIXES.items():
        t = re.sub(old, new, t, flags=re.IGNORECASE)
    if t and t[0].islower():
        t = t[0].upper() + t[1:]
    if t and t[-1] not in ".?!":
        t += "."
    return t


def main() -> int:
    if not MP3.exists():
        print(f"Missing source: {MP3}", file=sys.stderr)
        return 1

    model_name = "medium"
    print(f"Loading model={model_name} ...", flush=True)
    model = WhisperModel(model_name, device="cpu", compute_type="int8")

    print(f"Transcribing {MP3} ...", flush=True)
    segments_iter, info = model.transcribe(
        str(MP3),
        language="en",
        vad_filter=True,
        beam_size=5,
        word_timestamps=False,
    )

    rows = []
    for seg in segments_iter:
        rows.append(
            {
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "text": cleanup_text(seg.text),
            }
        )
        if len(rows) % 50 == 0:
            print(f"  segments={len(rows)} last={fmt_ts(seg.end)}", flush=True)

    payload = {
        "source": str(MP3.relative_to(ROOT)),
        "model": model_name,
        "language": info.language,
        "duration_sec": round(info.duration, 3),
        "transcribed_at": datetime.utcnow().isoformat() + "Z",
        "segment_count": len(rows),
        "segments": rows,
    }
    OUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    lines = [
        "# Full English Transcript",
        "",
        f"- **Source:** `{payload['source']}`",
        f"- **Duration:** {fmt_ts(info.duration)} ({info.duration:.1f}s)",
        f"- **Model:** faster-whisper `{model_name}`",
        f"- **Language:** {info.language}",
        f"- **Segments:** {len(rows)}",
        f"- **Transcribed:** {payload['transcribed_at']}",
        "",
        "---",
        "",
    ]
    for row in rows:
        lines.append(f"[{fmt_ts(row['start'])}] {row['text']}")
        lines.append("")

    OUT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT_JSON}")
    print(f"Wrote {OUT_MD}")
    print(f"duration={info.duration:.1f}s segments={len(rows)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
