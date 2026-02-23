import os
import json
from pathlib import Path
import subprocess
import re

def get_video_duration(video_path):
    """Get video duration in seconds using ffprobe"""
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', 
             '-of', 'default=noprint_wrappers=1:nokey=1', str(video_path)],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0 and result.stdout.strip():
            return float(result.stdout.strip())
    except Exception as e:
        print(f"Warning: Could not get duration for {video_path}: {e}")
    return None

def find_preview_video(key):
    """Find matching video file in preview folder"""
    preview_path = Path('assets/preview')
    if not preview_path.exists():
        return None
    
    # Try exact match first
    video_file = preview_path / f"{key}.mp4"
    if video_file.exists():
        return video_file
    
    # Try case-insensitive match
    for video in preview_path.glob('*.mp4'):
        if video.stem.lower() == key.lower():
            return video
    
    return None

def sanitize_key(filename):
    """Convert filename to a valid JSON key (remove extension and special chars)"""
    # Remove .png extension
    key = filename.replace('.png', '')
    # Remove special characters and spaces, convert to lowercase
    key = key.replace(' ', '').replace('(', '').replace(')', '').replace('.', '')
    key = key.replace('&', '').replace(',', '').replace("'", '').lower()
    return key

def extract_artist_title(filename):
    """Try to extract artist and title from filename"""
    name = filename.replace('.png', '')
    
    # Return filename (without extension) in lowercase as title
    return "", name.lower()

def create_track_entry(cover_filename):
    """Create a track entry with default values matching tracks.json format"""
    key = sanitize_key(cover_filename)
    artist, title = extract_artist_title(cover_filename)
    
    # If no artist extracted, use generic artist name
    if not artist:
        artist = "Unknown Artist"
    
    # If no title, use the filename
    if not title:
        title = cover_filename.replace('.png', '')
    
    return {
        key: {
            "title": title,
            "artist": artist,
            "releaseYear": 2024,
            "cover": cover_filename,
            "bpm": 120,
            "key": "C Major",
            "duration": "3m 00s",
            "album": "Unknown Album",
            "genre": "Unknown",
            "rating": "Everyone",
            "difficulties": {
                "vocals": -1,
                "lead": -1,
                "bass": -1,
                "drums": -1,
                "plastic-bass": -1,
                "plastic-drums": -1,
                "plastic-guitar": -1
            },
            "createdAt": "2026-02-22T00:00:00.000Z",
            "lastFeatured": "2026-02-22T00:00:00.000Z",
            "complete": "0%",
            "spotify": "",
            "videoUrl": "",
            "videoPosition": 0,
            "loading_phrase": "",
            "rank": False,
            "previewUrl": "",
            "preview_time": "0",
            "preview_end_time": "0",
            "rotated": True,
            "modalShadowColors": {
                "default": {
                    "color1": "#8a2be2",
                    "color2": "#4b0082"
                },
                "hover": {
                    "color1": "#4b0082",
                    "color2": "#8a2be2"
                }
            },
            "youtubeLinks": {
                "vocals": "",
                "lead": "",
                "bass": "",
                "drums": ""
            },
            "charter": ""
        }
    }

def load_info_from_covert_folder(cover_filename):
    """Load track info from covert/[folder]/info.json"""
    covert_path = Path('covert')
    
    if not covert_path.exists():
        return None
    
    # Try to find matching folder
    key = sanitize_key(cover_filename)
    
    # Search for folder that might contain this track
    for folder in covert_path.iterdir():
        if not folder.is_dir():
            continue
        
        info_file = folder / 'info.json'
        if not info_file.exists():
            continue
        
        try:
            with open(info_file, 'r', encoding='utf-8') as f:
                info = json.load(f)
                
                # Check if this matches by comparing shortname or sanitized title
                info_key = info.get('shortname', sanitize_key(info.get('title', '')))
                
                if info_key == key or sanitize_key(folder.name) == key:
                    return info
        except Exception as e:
            print(f"Warning: Could not load {info_file}: {e}")
    
    return None

def convert_info_to_track_format(info, cover_filename):
    """Convert info.json format to tracks.json format"""
    key = sanitize_key(cover_filename)
    
    # Get preview times
    preview_start = info.get('preview_start_time', 0)
    preview_end = preview_start + 40000  # 40 seconds after start
    
    # Map difficulties
    diff = info.get('diff', {})
    difficulties = {
        "vocals": diff.get('vocals', -1),
        "lead": diff.get('guitar', -1),
        "bass": diff.get('bass', -1),
        "drums": diff.get('drums', -1),
        "plastic-bass": -1,
        "plastic-drums": -1,
        "plastic-guitar": -1
    }
    
    # Get charter (first one if multiple)
    charters = info.get('charters', [])
    charter = charters[0] if charters else ""
    
    # Get genre (first one if multiple)
    genres = info.get('genres', [])
    genre = genres[0] if genres else "Unknown"
    
    # Calculate duration from length (seconds)
    length_seconds = info.get('length', 180)
    minutes = length_seconds // 60
    seconds = length_seconds % 60
    duration = f"{minutes}m {seconds:02d}s"
    
    return {
        key: {
            "title": info.get('title', cover_filename.replace('.png', '')).lower(),
            "artist": info.get('artist', 'Unknown Artist'),
            "releaseYear": int(info.get('release_year', 2024)),
            "cover": cover_filename,
            "bpm": 120,  # Not in info.json, keep default
            "key": "C Major",  # Not in info.json, keep default
            "duration": duration,
            "album": info.get('album', 'Unknown Album'),
            "genre": genre,
            "rating": "Everyone",
            "difficulties": difficulties,
            "createdAt": "2026-02-22T00:00:00.000Z",
            "lastFeatured": "2026-02-22T00:00:00.000Z",
            "complete": "100%",
            "spotify": "",
            "videoUrl": f"{key}.mp4",
            "videoPosition": preview_start / 1000,  # Convert ms to seconds
            "loading_phrase": info.get('loading_phrase', ''),
            "rank": True,
            "previewUrl": f"/assets/audio/{key}.mp3",
            "preview_time": str(preview_start),
            "preview_end_time": str(preview_end),
            "rotated": True,
            "modalShadowColors": {
                "default": {
                    "color1": "#8a2be2",
                    "color2": "#4b0082"
                },
                "hover": {
                    "color1": "#4b0082",
                    "color2": "#8a2be2"
                }
            },
            "youtubeLinks": {
                "vocals": "",
                "lead": "",
                "bass": "",
                "drums": ""
            },
            "charter": charter
        }
    }

def load_existing_tracks():
    """Load all existing track data from JSON files in data folder"""
    existing_tracks = {}
    data_path = Path('data')
    
    if not data_path.exists():
        return existing_tracks
    
    # Load all JSON files in data folder
    for json_file in data_path.glob('*.json'):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                tracks = json.load(f)
                existing_tracks.update(tracks)
                print(f"Loaded {len(tracks)} tracks from {json_file.name}")
        except Exception as e:
            print(f"Warning: Could not load {json_file}: {e}")
    
    return existing_tracks

def main():
    # Path to covers folder
    covers_path = Path('assets/covers')
    
    if not covers_path.exists():
        print(f"Error: {covers_path} does not exist")
        return
    
    # Load existing track data from all JSON files
    print("Loading existing track data...")
    existing_tracks = load_existing_tracks()
    print(f"Loaded {len(existing_tracks)} existing tracks\n")
    
    # Get all PNG files from covers folder
    cover_files = sorted([f.name for f in covers_path.glob('*.png')])
    
    if not cover_files:
        print(f"No PNG files found in {covers_path}")
        return
    
    print(f"Found {len(cover_files)} cover images\n")
    
    # Create tracks dictionary
    all_tracks = {}
    
    for cover_file in cover_files:
        key = sanitize_key(cover_file)
        
        # First, try to load from covert folder info.json
        info = load_info_from_covert_folder(cover_file)
        
        if info:
            # Use info.json data
            track_entry = convert_info_to_track_format(info, cover_file)
            all_tracks.update(track_entry)
            print(f"Loaded from covert folder: {cover_file}")
        elif key in existing_tracks:
            # Use existing data from JSON files
            track_data = existing_tracks[key].copy()
            track_data['cover'] = cover_file
            all_tracks[key] = track_data
            print(f"Using existing JSON data: {cover_file}")
        else:
            # Create new entry with defaults
            track_entry = create_track_entry(cover_file)
            all_tracks.update(track_entry)
            print(f"Created new entry: {cover_file}")
    
    # Write to tracks_all.json with proper formatting
    output_path = Path('data/tracks_all.json')
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_tracks, f, indent=2, ensure_ascii=False)
    
    print(f"\nSuccessfully created {output_path} with {len(all_tracks)} tracks")

if __name__ == "__main__":
    main()
