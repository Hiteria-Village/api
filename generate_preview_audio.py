import json
import os
import subprocess
from pathlib import Path

def generate_preview_audio():
    """Generate preview audio files by combining OGG stems at specified preview times"""
    
    covert_dir = Path('covert')
    output_dir = Path('assets/audio')
    tracks_file = Path('data/tracks.json')
    
    # Load tracks data
    with open(tracks_file, 'r', encoding='utf-8') as f:
        tracks = json.load(f)
    
    # Check if ffmpeg is available
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("ERROR: ffmpeg is not installed or not in PATH")
        print("Please install ffmpeg: https://ffmpeg.org/download.html")
        return
    
    updated_tracks = {}
    
    for track_id, track_data in tracks.items():
        # Find corresponding covert folder
        covert_folder = None
        for folder in covert_dir.iterdir():
            if not folder.is_dir():
                continue
            info_file = folder / 'info.json'
            if info_file.exists():
                with open(info_file, 'r', encoding='utf-8') as f:
                    info = json.load(f)
                    if info.get('shortname') == track_id or folder.name.lower().replace(' ', '').replace(',', '').replace('-', '') == track_id:
                        covert_folder = folder
                        break
        
        if not covert_folder:
            print(f"Skipping {track_id} - no covert folder found")
            updated_tracks[track_id] = track_data
            continue
        
        # Load info.json
        info_file = covert_folder / 'info.json'
        with open(info_file, 'r', encoding='utf-8') as f:
            info = json.load(f)
        
        # Get preview time in milliseconds
        preview_start_ms = int(track_data.get('preview_time', 0))
        preview_duration = 40  # 40 seconds
        
        # Get stems
        stems = info.get('stems', {})
        stem_files = []
        
        # Check which stems exist
        for stem_type in ['drums', 'bass', 'lead', 'vocals', 'backing']:
            stem_file = stems.get(stem_type)
            if stem_file:
                # Handle both string and list formats
                if isinstance(stem_file, list):
                    for sf in stem_file:
                        stem_path = covert_folder / sf
                        if stem_path.exists():
                            stem_files.append(str(stem_path))
                else:
                    stem_path = covert_folder / stem_file
                    if stem_path.exists():
                        stem_files.append(str(stem_path))
        
        if not stem_files:
            print(f"Skipping {track_id} - no stem files found")
            updated_tracks[track_id] = track_data
            continue
        
        # Output file
        output_file = output_dir / f"{track_id}.mp3"
        
        # Build ffmpeg command
        # Convert milliseconds to seconds for ffmpeg
        start_time = preview_start_ms / 1000.0
        
        # Create filter complex for mixing all stems
        inputs = []
        for stem in stem_files:
            inputs.extend(['-i', stem])
        
        filter_complex = f"{''.join([f'[{i}:a]' for i in range(len(stem_files))])}amix=inputs={len(stem_files)}:duration=first:dropout_transition=2[out]"
        
        cmd = [
            'ffmpeg',
            '-y',  # Overwrite output file
            *inputs,
            '-filter_complex', filter_complex,
            '-map', '[out]',
            '-ss', str(start_time),
            '-t', str(preview_duration),
            '-b:a', '192k',
            str(output_file)
        ]
        
        print(f"Generating preview for {track_id}...")
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                print(f"  ✓ Created {output_file}")
                
                # Update track data with correct preview_end_time
                track_data['preview_end_time'] = str(preview_start_ms + (preview_duration * 1000))
                
                # Fix instrument icon names: change 'guitar' to 'lead' in difficulties
                if 'difficulties' in track_data:
                    difficulties = track_data['difficulties']
                    if 'guitar' in difficulties:
                        # Map guitar to lead for proper icon display
                        difficulties['lead'] = difficulties.pop('guitar')
                
            else:
                print(f"  ✗ Error generating {track_id}: {result.stderr}")
        except Exception as e:
            print(f"  ✗ Exception generating {track_id}: {e}")
        
        updated_tracks[track_id] = track_data
    
    # Save updated tracks.json
    with open(tracks_file, 'w', encoding='utf-8') as f:
        json.dump(updated_tracks, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Preview generation complete!")
    print(f"✓ Updated tracks.json with corrected instrument names")

if __name__ == '__main__':
    generate_preview_audio()
