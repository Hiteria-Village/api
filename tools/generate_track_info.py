#!/usr/bin/env python3
"""
generate_track_info.py
Drag a song folder onto this script (or pass it as an argument) to generate
a tracks.json-compatible JSON object AND a 40s preview MP3 for assets/audio.

Usage:
    python generate_track_info.py "G:/My Drive/Octave/Song Files/deadmau5, Gerard Way - Professional Griefers"
Or drag the folder onto this .py file in Windows Explorer (if associated).

Requirements:
    ffmpeg must be installed and on PATH (or in the WinGet install location).
"""

import sys
import os
import json
import re
import subprocess
import shutil
from datetime import datetime, timezone


# ── constants ─────────────────────────────────────────────────────────────────

PREVIEW_DURATION   = 40          # seconds
FADE_OUT_DURATION  = 3           # seconds fade at end
OUTPUT_BITRATE     = "192k"
OUTPUT_SAMPLE_RATE = 44100
# assets/audio is two levels up from tools/
ASSETS_AUDIO_DIR = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "audio")
)


# ── helpers ───────────────────────────────────────────────────────────────────

def find_ffmpeg() -> str:
    """Return ffmpeg executable path, checking PATH then WinGet fallback."""
    if shutil.which("ffmpeg"):
        return "ffmpeg"
    winget_path = os.path.expandvars(
        r"%LOCALAPPDATA%\Microsoft\WinGet\Packages"
    )
    if os.path.isdir(winget_path):
        for root, dirs, files in os.walk(winget_path):
            for f in files:
                if f.lower() == "ffmpeg.exe":
                    return os.path.join(root, f)
    raise FileNotFoundError(
        "ffmpeg not found. Install it via: winget install Gyan.FFmpeg"
    )


def slugify(text: str) -> str:
    text = re.sub(r"[^a-zA-Z0-9 ]", "", text)
    words = text.split()
    if not words:
        return "unknown"
    return words[0].lower() + "".join(w.capitalize() for w in words[1:])


def seconds_to_duration(seconds: int) -> str:
    m, s = divmod(int(seconds), 60)
    return f"{m}m {s:02d}s"


def detect_difficulties(info: dict) -> dict:
    raw = info.get("diff", {})
    return {
        "vocals":          raw.get("vocals", -1),
        "lead":            raw.get("guitar", raw.get("lead", -1)),
        "bass":            raw.get("bass", -1),
        "drums":           raw.get("drums", -1),
        "plastic-bass":    -1,
        "plastic-drums":   -1,
        "plastic-guitar":  -1,
    }


def detect_keys(folder_path: str, info: dict) -> bool:
    if "keys" in info.get("stems", {}):
        return True
    if "keys" in info.get("diff", {}):
        return True
    for f in os.listdir(folder_path):
        if f.lower().startswith("keys") and f.lower().endswith(".ogg"):
            return True
    return False


def collect_stem_files(folder_path: str, info: dict) -> list[str]:
    """
    Return absolute paths of all .ogg stem files in the folder.
    Uses the stems dict from info.json; falls back to scanning for any .ogg.
    Excludes files in subdirectories (e.g. Old Stems/).
    """
    stems = info.get("stems", {})
    if stems:
        paths = []
        for stem_file in stems.values():
            full = os.path.join(folder_path, stem_file)
            if os.path.isfile(full):
                paths.append(full)
        if paths:
            return paths

    # Fallback: all .ogg files directly in the folder
    return [
        os.path.join(folder_path, f)
        for f in os.listdir(folder_path)
        if f.lower().endswith(".ogg") and os.path.isfile(os.path.join(folder_path, f))
    ]


# ── audio generation ──────────────────────────────────────────────────────────

def generate_preview(
    ffmpeg: str,
    stem_files: list[str],
    preview_start_ms: int,
    output_path: str,
) -> None:
    """
    Trim each stem individually to the preview window, mix them all together,
    apply a fade-out, and export as 192kbps MP3.

    Trimming per-stem (rather than after amix) ensures stems with slightly
    different lengths don't cause amix to cut early or pad incorrectly.
    """
    start_sec  = preview_start_ms / 1000.0
    fade_start = PREVIEW_DURATION - FADE_OUT_DURATION
    n = len(stem_files)

    # One -i per stem
    inputs = []
    for s in stem_files:
        inputs += ["-i", s]

    # Trim + reset timestamps on each stem individually, then mix
    trim_chain = "".join(
        f"[{i}:a]atrim=start={start_sec}:duration={PREVIEW_DURATION},asetpts=PTS-STARTPTS[s{i}];"
        for i in range(n)
    )
    mix_inputs = "".join(f"[s{i}]" for i in range(n))

    if n == 1:
        filter_complex = (
            f"[0:a]atrim=start={start_sec}:duration={PREVIEW_DURATION},"
            f"asetpts=PTS-STARTPTS,"
            f"afade=t=out:st={fade_start}:d={FADE_OUT_DURATION}[out]"
        )
    else:
        filter_complex = (
            f"{trim_chain}"
            f"{mix_inputs}amix=inputs={n}:normalize=0:duration=longest,"
            f"afade=t=out:st={fade_start}:d={FADE_OUT_DURATION}[out]"
        )

    cmd = [
        ffmpeg, "-y",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[out]",
        "-ar", str(OUTPUT_SAMPLE_RATE),
        "-b:a", OUTPUT_BITRATE,
        output_path,
    ]

    print(f"\n── Generating preview audio ──")
    print(f"   Stems:  {n} file(s)")
    print(f"   Start:  {start_sec:.3f}s  |  Duration: {PREVIEW_DURATION}s  |  Fade-out: {FADE_OUT_DURATION}s")
    print(f"   Output: {output_path}\n")

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed:\n{result.stderr[-2000:]}")

    size_kb = os.path.getsize(output_path) // 1024
    print(f"✓ Preview saved ({size_kb} KB): {output_path}")


# ── track info generation ─────────────────────────────────────────────────────

def process_folder(folder_path: str) -> tuple[str, dict, dict]:
    """Returns (track_key, track_dict, info_dict)."""
    folder_path = os.path.normpath(folder_path)

    if not os.path.isdir(folder_path):
        raise ValueError(f"Not a directory: {folder_path}")

    info_path = os.path.join(folder_path, "info.json")
    if not os.path.isfile(info_path):
        raise FileNotFoundError(f"No info.json found in: {folder_path}")

    with open(info_path, "r", encoding="utf-8") as f:
        info = json.load(f)

    title        = info.get("title", "Unknown Title")
    artist       = info.get("artist", "Unknown Artist")
    album        = info.get("album", "Unknown Album")
    length       = info.get("length", 0)
    song_id      = info.get("song_id", "")
    charters     = info.get("charters", [])
    genres       = info.get("genres", [])
    release_year = int(info.get("release_year", datetime.now().year))
    preview_start = info.get("preview_start_time", 0)  # ms

    base_title = title.split(" - ")[0].strip()
    track_key  = slugify(base_title)

    art_file   = info.get("art", "cover.png")
    cover      = os.path.splitext(art_file)[0] + ".png"
    duration   = seconds_to_duration(length)
    genre      = genres[0] if genres else "Unknown"
    charter    = ", ".join(charters) if charters else "Unknown"
    difficulties = detect_difficulties(info)
    has_keys   = detect_keys(folder_path, info)
    now_iso    = datetime.now(timezone.utc).strftime("%Y-%m-%dT00:00:00.000Z")

    track = {
        "title":        title,
        "artist":       artist,
        "releaseYear":  release_year,
        "cover":        cover,
        "bpm":          0,
        "key":          "",
        "duration":     duration,
        "album":        album,
        "genre":        genre,
        "rating":       "Everyone",
        "difficulties": difficulties,
        "createdAt":    now_iso,
        "lastFeatured": now_iso,
        "complete":     "100%",
        "spotify":      "",
        "videoUrl":     f"{track_key}.mp4",
        "videoPosition": 50,
        "loading_phrase": info.get("loading_phrase", ""),
        "rank":         True,
        "previewUrl":   f"/assets/audio/{track_key}.mp3",
        "preview_time": "0",
        "preview_end_time": str(preview_start) if preview_start else "40000",
        "shop":         True,
        "sid":          song_id,
        "modalShadowColors": {
            "default": {"color1": "#8a2be2", "color2": "#4b0082"},
            "hover":   {"color1": "#4b0082", "color2": "#8a2be2"},
        },
        "youtubeLinks": {"vocals": "", "lead": "", "bass": "", "drums": ""},
        "charter":      charter,
    }

    if has_keys:
        track["keys"] = "true"

    return track_key, track, info


# ── entry point ───────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print("Usage: drag a song folder onto this script, or run:")
        print('  python generate_track_info.py "<path to song folder>"')
        input("\nPress Enter to exit...")
        sys.exit(1)

    folder_path = sys.argv[1].strip('"').strip("'")

    # ── track info ────────────────────────────────────────────────────────────
    try:
        key, track, info = process_folder(folder_path)
    except (ValueError, FileNotFoundError) as e:
        print(f"Error: {e}")
        input("\nPress Enter to exit...")
        sys.exit(1)

    output = {key: track}
    result_json = json.dumps(output, indent=2, ensure_ascii=False)

    print(f"\n── Generated track key: \"{key}\" ──\n")
    print(result_json)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    out_json = os.path.join(script_dir, f"{key}_track.json")
    with open(out_json, "w", encoding="utf-8") as f:
        f.write(result_json)
    print(f"\n✓ JSON saved to: {out_json}")

    # ── preview audio ─────────────────────────────────────────────────────────
    try:
        ffmpeg = find_ffmpeg()
    except FileNotFoundError as e:
        print(f"\n⚠ Skipping audio: {e}")
        input("\nPress Enter to exit...")
        sys.exit(0)

    stem_files = collect_stem_files(folder_path, info)
    if not stem_files:
        print("\n⚠ No stem .ogg files found — skipping audio generation.")
    else:
        os.makedirs(ASSETS_AUDIO_DIR, exist_ok=True)
        out_mp3 = os.path.join(ASSETS_AUDIO_DIR, f"{key}.mp3")
        preview_start_ms = info.get("preview_start_time", 0)

        try:
            generate_preview(ffmpeg, stem_files, preview_start_ms, out_mp3)
        except RuntimeError as e:
            print(f"\n✗ Audio generation failed: {e}")

    print("\nFields to fill in manually: bpm, key, spotify, videoPosition, videoZoom (optional)")
    input("\nPress Enter to exit...")


if __name__ == "__main__":
    main()
