import json

with open('data/tracks.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Check a few sample tracks
samples = ['threesixtyfive', 'crazy', 'lsplashelevatorjam']

for track_id in samples:
    if track_id in data:
        track = data[track_id]
        preview_time = int(track['preview_time'])
        preview_end = int(track['preview_end_time'])
        duration = preview_end - preview_time
        
        print(f"\n{track_id}:")
        print(f"  Title: {track['title']}")
        print(f"  Preview time: {preview_time}ms")
        print(f"  Preview end: {preview_end}ms")
        print(f"  Duration: {duration}ms ({duration/1000}s)")
        print(f"  Difficulties: {track['difficulties']}")
        print(f"  Has 'lead' instrument: {'lead' in track['difficulties']}")
        print(f"  Has 'guitar' instrument: {'guitar' in track['difficulties']}")
