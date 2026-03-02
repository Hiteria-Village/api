import os
import json
import shutil
from pathlib import Path

# Source directory containing covert folders
source_dir = Path("covert")

# Destination directory for cover art
dest_dir = Path(r"C:\Users\jayde\OneDrive\Documents\GitHub\hiteriavillage.github.io\assets\covers")

# Create destination directory if it doesn't exist
dest_dir.mkdir(parents=True, exist_ok=True)

# Counter for processed files
copied_count = 0
skipped_count = 0

# Iterate through each folder in covert directory
for folder in source_dir.iterdir():
    if not folder.is_dir():
        continue
    
    # Look for info.json to get the title
    info_file = folder / "info.json"
    cover_file = folder / "cover.png"
    
    if not cover_file.exists():
        print(f"⚠️  No cover.png found in {folder.name}")
        skipped_count += 1
        continue
    
    # Get title from info.json if it exists, otherwise use folder name
    if info_file.exists():
        try:
            with open(info_file, 'r', encoding='utf-8') as f:
                info = json.load(f)
                title = info.get('title', folder.name)
        except Exception as e:
            print(f"⚠️  Error reading {info_file}: {e}")
            title = folder.name
    else:
        title = folder.name
    
    # Convert title to lowercase and create filename
    filename = title.lower().replace(' ', '') + '.png'
    dest_path = dest_dir / filename
    
    # Copy the cover art
    try:
        shutil.copy2(cover_file, dest_path)
        print(f"✓ Copied: {title} -> {filename}")
        copied_count += 1
    except Exception as e:
        print(f"✗ Error copying {cover_file}: {e}")
        skipped_count += 1

print(f"\n{'='*50}")
print(f"✓ Successfully copied: {copied_count} files")
print(f"⚠️  Skipped: {skipped_count} files")
print(f"📁 Destination: {dest_dir}")
