import json

with open('data/tracks.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f'Total tracks: {len(data)}')
print('\nAll tracks:')
for i, (k, v) in enumerate(data.items(), 1):
    print(f'{i}. {k}: {v["title"]} by {v["artist"]} (preview: {v["preview_time"]}ms)')
