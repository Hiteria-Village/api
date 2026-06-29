#!/usr/bin/env python3
"""
Generate MP3 preview from OGG stems in a song folder.

This script:
1. Reads info.json from a song folder
2. Combines all OGG stems into one audio track
3. Extracts a 30-second preview starting at preview_start_time (in ms)
4. Applies fade-out effect at the end
5. Exports as MP3

Requirements:
    pip install pydub

You also need ffmpeg installed on your system:
    - Windows: Download from https://ffmpeg.org/download.html
    - Or use: choco install ffmpeg (if you have Chocolatey)
    - Or use: winget install ffmpeg (if you have winget)

Usage:
    python generate_preview.py "path/to/song/folder"
    python generate_preview.py "path/to/song/folder" --output "custom_output.mp3"
"""

import json
import os
import sys
import argparse
from pathlib import Path
from pydub import AudioSegment


def pause(message="Press any key to continue . . . "):
    """
    Mimic the Windows batch 'pause' command so a console window opened by
    double-clicking the script doesn't close before an error can be read.
    """
    try:
        import msvcrt  # Windows-only
        print(message, end="", flush=True)
        msvcrt.getch()
        print()
    except ImportError:
        # Not on Windows - fall back to waiting for Enter
        input(message)


def load_song_info(folder_path):
    """Load and parse info.json from the song folder."""
    info_path = folder_path / "info.json"
    
    if not info_path.exists():
        raise FileNotFoundError(f"info.json not found in {folder_path}")
    
    with open(info_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def combine_stems(folder_path):
    """Combine all OGG stems into a single audio track."""
    # Standard stem files to look for
    stem_files = ["drums.ogg", "bass.ogg", "lead.ogg", "backing.ogg", "vocals.ogg"]
    
    combined = None
    stems_found = 0
    
    for stem_file in stem_files:
        stem_path = folder_path / stem_file
        
        if not stem_path.exists():
            print(f"Warning: {stem_file} not found, skipping...")
            continue
        
        print(f"Loading: {stem_file}")
        audio = AudioSegment.from_ogg(str(stem_path))
        
        if combined is None:
            combined = audio
        else:
            # Overlay stems together (mix without reducing volume)
            combined = combined.overlay(audio)
        
        stems_found += 1
    
    if combined is None:
        raise ValueError("No valid stems found to combine")
    
    print(f"Successfully combined {stems_found} stems")
    return combined


def normalize_audio(audio, target_dBFS=-14.0):
    """
    Normalize audio to a target loudness level.
    
    Args:
        audio: AudioSegment to normalize
        target_dBFS: Target loudness in dBFS (default -14.0 for streaming quality)
    
    Returns:
        Normalized AudioSegment
    """
    # Calculate the difference between current and target loudness
    change_in_dBFS = target_dBFS - audio.dBFS
    
    # Apply the gain change
    normalized = audio.apply_gain(change_in_dBFS)
    
    print(f"Audio normalized from {audio.dBFS:.2f} dBFS to {normalized.dBFS:.2f} dBFS")
    
    return normalized


def create_preview(combined_audio, preview_start_ms, duration_ms=30000, fade_duration_ms=3000):
    """
    Extract preview segment and apply fade-out.
    
    Args:
        combined_audio: Combined AudioSegment
        preview_start_ms: Start time in milliseconds
        duration_ms: Duration of preview (default 30 seconds)
        fade_duration_ms: Duration of fade-out effect (default 3 seconds)
    """
    # Extract the preview segment
    preview_end_ms = preview_start_ms + duration_ms
    preview = combined_audio[preview_start_ms:preview_end_ms]
    
    # Apply fade-out at the end
    preview = preview.fade_out(fade_duration_ms)
    
    return preview


def generate_preview(song_folder, output_path=None, duration=30, fade_duration=3):
    """
    Main function to generate MP3 preview from a song folder.
    
    Args:
        song_folder: Path to the song folder containing info.json and OGG files
        output_path: Optional custom output path for the MP3 file
        duration: Preview duration in seconds (default 30)
        fade_duration: Fade-out duration in seconds (default 3)
    """
    folder_path = Path(song_folder)
    
    if not folder_path.exists():
        raise FileNotFoundError(f"Song folder not found: {song_folder}")
    
    # Load song info
    print("Loading song info...")
    info = load_song_info(folder_path)
    
    # Get preview start time
    preview_start_ms = info.get("preview_start_time")
    if preview_start_ms is None:
        raise ValueError("preview_start_time not found in info.json")
    
    print(f"Preview start time: {preview_start_ms}ms ({preview_start_ms/1000:.2f}s)")
    
    # Combine stems
    print("\nCombining stems...")
    combined_audio = combine_stems(folder_path)
    print(f"Combined audio duration: {len(combined_audio)}ms ({len(combined_audio)/1000:.2f}s)")
    
    # Normalize audio to maintain proper volume
    print("\nNormalizing audio levels...")
    combined_audio = normalize_audio(combined_audio)
    
    # Create preview
    print(f"\nCreating {duration}-second preview with {fade_duration}s fade-out...")
    preview = create_preview(
        combined_audio,
        preview_start_ms,
        duration_ms=duration * 1000,
        fade_duration_ms=fade_duration * 1000
    )
    
    # Determine output path
    if output_path is None:
        song_title = info.get("title", "preview")
        # Sanitize filename - remove all special characters and spaces
        safe_title = "".join(c for c in song_title.lower() if c.isalnum()).strip()
        # Export to the same folder as the script
        script_dir = Path(__file__).parent
        output_path = script_dir / f"{safe_title}.mp3"
    else:
        output_path = Path(output_path)
    
    # Export as MP3
    print(f"\nExporting to: {output_path}")
    preview.export(
        str(output_path),
        format="mp3",
        bitrate="192k",
        tags={
            'artist': info.get('artist', ''),
            'title': info.get('title', ''),
            'album': info.get('album', ''),
            'genre': ', '.join(info.get('genre', [])) if isinstance(info.get('genre'), list) else info.get('genre', '')
        }
    )
    
    print(f"\n✓ Preview generated successfully: {output_path}")
    return output_path


def main():
    parser = argparse.ArgumentParser(
        description="Generate MP3 preview from OGG stems in a song folder"
    )
    parser.add_argument(
        "folder",
        help="Path to the song folder containing info.json and OGG files"
    )
    parser.add_argument(
        "-o", "--output",
        help="Output path for the MP3 file (optional)",
        default=None
    )
    parser.add_argument(
        "-d", "--duration",
        type=int,
        default=30,
        help="Preview duration in seconds (default: 30)"
    )
    parser.add_argument(
        "-f", "--fade",
        type=int,
        default=3,
        help="Fade-out duration in seconds (default: 3)"
    )
    
    args = parser.parse_args()
    
    try:
        generate_preview(args.folder, args.output, args.duration, args.fade)
    except Exception as e:
        print(f"\n✗ Error: {e}", file=sys.stderr)
        pause()
        sys.exit(1)


if __name__ == "__main__":
    main()