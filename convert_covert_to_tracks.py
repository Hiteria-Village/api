import json
import os
from pathlib import Path

def convert_covert_to_tracks():
    """Convert covert song data to tracks.json format"""
    
    covert_dir = Path('covert')
    tracks_file = Path('data/tracks.json')
    
    # Load existing tracks
    with open(tracks_file, 'r', encoding='utf-8') as f:
        tracks = json.load(f)
    
    # Process each song folder in covert directory
    for song_folder in covert_dir.iterdir():
        if not song_folder.is_dir():
            continue
            
        info_file = song_folder / 'info.json'
        if not info_file.exists():
            print(f"Skipping {song_folder.name} - no info.json found")
            continue
        
        # Load song info
        with open(info_file, 'r', encoding='utf-8') as f:
            song_data = json.load(f)
        
        # Create track ID from shortname or folder name
        track_id = song_data.get('shortname', song_folder.name.lower().replace(' ', '').replace(',', '').replace('-', ''))
        
        # Check if track already exists
        if track_id in tracks:
            print(f"Track {track_id} already exists, skipping...")
            continue
        
        # Map covert format to tracks.json format
        track_entry = {
            "title": song_data.get('title', song_folder.name),
            "artist": song_data.get('artist', 'Unknown'),
            "releaseYear": int(song_data.get('release_year', 2024)),
            "cover": song_data.get('art', 'cover.png').replace('cover.png', f'{track_id}.png'),
            "bpm": song_data.get('bpm', 120),
            "key": song_data.get('key', 'Unknown'),
            "duration": f"{song_data.get('length', 180) // 60}m {song_data.get('length', 180) % 60:02d}s",
            "album": song_data.get('album', 'Unknown Album'),
            "genre": song_data.get('genres', ['Unknown'])[0] if song_data.get('genres') else 'Unknown',
            "rating": "Everyone",
            "difficulties": {
                "vocals": song_data.get('diff', {}).get('vocals', -1),
                "guitar": song_data.get('diff', {}).get('guitar', -1),
                "bass": song_data.get('diff', {}).get('bass', -1),
                "drums": song_data.get('diff', {}).get('drums', -1),
                "plastic-bass": -1,
                "plastic-drums": -1,
                "plastic-guitar": -1
            },
            "createdAt": "2025-02-14T00:00:00.000Z",
            "lastFeatured": "2025-02-14T00:00:00.000Z",
            "complete": "100%",
            "spotify": song_data.get('spotify_id', ''),
            "videoUrl": f"{track_id}.mp4",
            "videoPosition": song_data.get('preview_start_time', 0) / 1000,  # Convert ms to seconds
            "loading_phrase": song_data.get('loading_phrase', ''),
            "previewUrl": f"/assets/audio/{track_id}.mp3",
            "preview_time": str(song_data.get('preview_start_time', 0)),
            "preview_end_time": str(song_data.get('preview_start_time', 0) + 30000),  # 30 seconds preview
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
            "charter": song_data.get('charters', ['Unknown'])[0] if song_data.get('charters') else 'Unknown'
        }
        
        # Add to tracks
        tracks[track_id] = track_entry
        print(f"Added track: {track_id} - {track_entry['title']}")
    
    # Save updated tracks.json
    with open(tracks_file, 'w', encoding='utf-8') as f:
        json.dump(tracks, f, indent=2, ensure_ascii=False)
    
    print(f"\nConversion complete! Total tracks: {len(tracks)}")
    print(f"Tracks file saved to: {tracks_file}")

if __name__ == '__main__':
    convert_covert_to_tracks()
