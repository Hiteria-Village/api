import json
import os
import subprocess
from pathlib import Path

def generate_preview_audio():
    """Generate preview audio files by combining OGG stems at specified preview times"""
    
    covert_dir = Path('covert')
    output_dir = Path('assets/audio')
    
    if not covert_dir.exists():
        print(f"ERROR: {covert_dir} directory not found")
        return
    
    # Check if ffmpeg is available
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("ERROR: ffmpeg is not installed or not in PATH")
        print("Please install ffmpeg: https://ffmpeg.org/download.html")
        return
    
    # Create output directory if it doesn't exist
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Process all folders in covert directory
    for covert_folder in sorted(covert_dir.iterdir()):
        if not covert_folder.is_dir():
            continue
        
        # Check if info.json exists
        info_file = covert_folder / 'info.json'
        if not info_file.exists():
            print(f"Skipping {covert_folder.name} - no info.json found")
            continue
        
        # Load info.json
        with open(info_file, 'r', encoding='utf-8') as f:
            info = json.load(f)
        
        # Get track ID (use shortname if available, otherwise sanitize folder name)
        track_id = info.get('shortname')
        if not track_id:
            # Sanitize folder name to create track_id
            track_id = covert_folder.name.lower().replace(' ', '').replace(',', '').replace('-', '').replace('(', '').replace(')', '').replace('.', '').replace("'", '').replace('&', '')
        
        # Get preview time in milliseconds
        preview_start_ms = info.get('preview_start_time', 0)
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
            print(f"Skipping {track_id} - no stem files found in {covert_folder.name}")
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
        
        print(f"Generating preview for {track_id} ({covert_folder.name})...")
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                print(f"  ✓ Created {output_file}")
            else:
                print(f"  ✗ Error generating {track_id}: {result.stderr}")
        except Exception as e:
            print(f"  ✗ Exception generating {track_id}: {e}")
    
    print(f"\n✓ Preview generation complete!")

if __name__ == '__main__':
    generate_preview_audio()
