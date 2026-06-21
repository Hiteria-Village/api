#!/usr/bin/env python3
import os
import json
import re

# Codepoint base: rank_1001 -> U+E04C, rank_1002 -> U+E04D, etc.
CODEPOINT_BASE = 0xE04C

def main():
    # Resolve absolute paths relative to this script's directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    tracks_path = os.path.join(script_dir, "..", "data", "tracks.json")
    rank_tags_path = os.path.join(script_dir, "..", "api", "ranks", "rank_tags.json")

    print("--- Rank Tags Generator ---")
    print(f"Loading tracks from: {os.path.abspath(tracks_path)}")
    print(f"Target rank tags file: {os.path.abspath(rank_tags_path)}")

    # 1. Load tracks.json
    if not os.path.exists(tracks_path):
        print(f"Error: tracks.json not found at {tracks_path}")
        return
    with open(tracks_path, "r", encoding="utf-8-sig") as f:
        tracks_data = json.load(f)

    # 2. Filter tracks where rank is true and sort by sid number
    ranked_tracks = []
    for key, track in tracks_data.items():
        if track.get("rank") is True:
            sid = track.get("sid", "")
            m = re.match(r"^sid_(\d+)$", sid)
            if m:
                sid_num = int(m.group(1))
                ranked_tracks.append((sid_num, key, track))
            else:
                print(f"Warning: Track '{key}' has rank=true but invalid/missing sid '{sid}'")

    # Sort by sid number (numerical)
    ranked_tracks.sort(key=lambda x: x[0])
    print(f"Found {len(ranked_tracks)} ranked tracks.")

    # 3. Load existing rank_tags.json
    if not os.path.exists(rank_tags_path):
        print(f"Warning: rank_tags.json not found, starting with empty list.")
        existing_tags = []
    else:
        with open(rank_tags_path, "r", encoding="utf-8-sig") as f:
            try:
                existing_tags = json.load(f)
            except Exception as e:
                print(f"Error parsing existing rank_tags.json: {e}")
                existing_tags = []

    # 4. Map existing sid numbers to preserved rank_id and codepoints
    existing_mappings = {}  # sid_num -> {"rank_id": str, "codepoint": int}
    for entry in existing_tags:
        preview = entry.get("preview", "")
        m = re.match(r"^oct_sid_(\d+)\.png$", preview)
        if m:
            sid_num = int(m.group(1))
            display_name = entry.get("displayName", "")
            codepoint = ord(display_name[0]) if display_name else None
            existing_mappings[sid_num] = {
                "rank_id": entry["id"],
                "codepoint": codepoint
            }

    # Gather used IDs and codepoints to prevent collisions when assigning new ones
    used_rank_nums = set()
    used_codepoints = set()
    for mapping in existing_mappings.values():
        used_codepoints.add(mapping["codepoint"])
        # Parse rank ID suffix e.g., rank_1001 -> 1001
        m_id = re.match(r"^rank_(\d+)$", mapping["rank_id"])
        if m_id:
            used_rank_nums.add(int(m_id.group(1)))

    def get_next_free_rank_num():
        n = 1001
        while n in used_rank_nums:
            n += 1
        used_rank_nums.add(n)
        return n

    def get_next_free_codepoint():
        cp = CODEPOINT_BASE
        while cp in used_codepoints:
            cp += 1
        used_codepoints.add(cp)
        return cp

    # Remove all existing rank_1XXX (and higher dynamic) entries from the list
    retained_tags = [e for e in existing_tags if not re.match(r"^rank_1\d{3,}$", e.get("id", ""))]

    # 5. Build fresh rank tag entries for all ranked tracks
    for sid_num, key, track in ranked_tracks:
        preview = f"oct_sid_{sid_num:02d}.png"
        title = track.get("title", key)

        if sid_num in existing_mappings:
            rank_id = existing_mappings[sid_num]["rank_id"]
            codepoint = existing_mappings[sid_num]["codepoint"]
            if codepoint is None:
                codepoint = get_next_free_codepoint()
        else:
            rank_id = f"rank_{get_next_free_rank_num()}"
            codepoint = get_next_free_codepoint()

        retained_tags.append({
            "id": rank_id,
            "name": title,
            "displayName": chr(codepoint),
            "color": "#FFFFFF",
            "preview": preview
        })

    # 6. Save the updated rank_tags.json
    os.makedirs(os.path.dirname(rank_tags_path), exist_ok=True)
    with open(rank_tags_path, "w", encoding="utf-8") as f:
        json.dump(retained_tags, f, ensure_ascii=False, indent=2)

    print(f"Successfully wrote {len(retained_tags)} rank tags to {rank_tags_path}")

if __name__ == "__main__":
    main()
