#!/usr/bin/env python3
import os
import json
import re
import subprocess

# Codepoint base: rank_1001 -> U+E04C, rank_1002 -> U+E04D, etc.
CODEPOINT_BASE = 0xE04C

def get_pushed_rank_tags(script_dir):
    """
    Attempts to fetch rank_tags.json from the current GitHub push / remote git refs.
    Tries origin/main, origin/HEAD, and HEAD in order.
    Returns a list of entries from the pushed file, or an empty list if unavailable.
    """
    repo_root = os.path.join(script_dir, "..")
    rank_tags_rel = "api/ranks/rank_tags.json"
    
    for ref in ["origin/main", "origin/HEAD", "HEAD"]:
        try:
            res = subprocess.run(
                ["git", "show", f"{ref}:{rank_tags_rel}"],
                cwd=repo_root,
                capture_output=True,
                text=True,
                encoding="utf-8-sig",
                check=True
            )
            data = json.loads(res.stdout)
            if isinstance(data, list) and len(data) > 0:
                print(f"Loaded {len(data)} pushed rank tag entries from git ref '{ref}'.")
                return data
        except Exception:
            continue

    print("Warning: Could not load pushed rank_tags.json from git refs.")
    return []

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
    print(f"Found {len(ranked_tracks)} ranked tracks in tracks.json.")

    # 3. Load pushed rank_tags.json from GitHub git ref
    pushed_tags = get_pushed_rank_tags(script_dir)
    pushed_mappings = {}  # sid_num -> {"rank_id": str, "codepoint": int}
    pushed_codepoints = set()
    pushed_rank_nums = set()

    for entry in pushed_tags:
        preview = entry.get("preview", "")
        display_name = entry.get("displayName", "")
        codepoint = ord(display_name[0]) if display_name else None
        if codepoint is not None:
            pushed_codepoints.add(codepoint)
        
        m_id = re.match(r"^rank_(\d+)$", entry.get("id", ""))
        if m_id:
            pushed_rank_nums.add(int(m_id.group(1)))

        m_sid = re.match(r"^oct_sid_(\d+)\.png$", preview)
        if m_sid:
            sid_num = int(m_sid.group(1))
            pushed_mappings[sid_num] = {
                "rank_id": entry["id"],
                "codepoint": codepoint
            }

    # 4. Load existing local rank_tags.json (if present) to retain static tags and local IDs
    if not os.path.exists(rank_tags_path):
        print(f"Warning: Local rank_tags.json not found.")
        local_tags = []
    else:
        with open(rank_tags_path, "r", encoding="utf-8-sig") as f:
            try:
                local_tags = json.load(f)
            except Exception as e:
                print(f"Error parsing existing rank_tags.json: {e}")
                local_tags = []

    # 5. Retain static non-dynamic tags (e.g. rank_01 .. rank_113)
    source_static_tags = local_tags if local_tags else pushed_tags
    retained_tags = [e for e in source_static_tags if not re.match(r"^rank_1\d{3,}$", e.get("id", ""))]

    # Gather used IDs and codepoints to prevent collisions when assigning new ones
    used_rank_nums = set()
    used_codepoints = set()

    # Track static tags usage
    for entry in retained_tags:
        display_name = entry.get("displayName", "")
        if display_name:
            used_codepoints.add(ord(display_name[0]))
        m_id = re.match(r"^rank_(\d+)$", entry.get("id", ""))
        if m_id:
            used_rank_nums.add(int(m_id.group(1)))

    # Track pushed tags usage
    used_codepoints.update(pushed_codepoints)
    used_rank_nums.update(pushed_rank_nums)

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

    # 6. Build fresh rank tag entries for all ranked tracks
    pushed_preserved_count = 0
    new_assigned_count = 0

    for sid_num, key, track in ranked_tracks:
        preview = f"oct_sid_{sid_num:02d}.png"
        title = track.get("title", key)

        if sid_num in pushed_mappings and pushed_mappings[sid_num]["codepoint"] is not None:
            # Entry is in the current GitHub push: preserve pushed rank_id and codepoint
            rank_id = pushed_mappings[sid_num]["rank_id"]
            codepoint = pushed_mappings[sid_num]["codepoint"]
            pushed_preserved_count += 1
        else:
            # Entry is NEW (not in current GitHub push): assign a new, unique codepoint
            local_entry = next((e for e in local_tags if e.get("preview") == preview), None)
            local_id = local_entry.get("id") if local_entry else None
            m_local_id = re.match(r"^rank_(\d+)$", local_id) if local_id else None
            
            if m_local_id and int(m_local_id.group(1)) not in used_rank_nums:
                rank_id = local_id
                used_rank_nums.add(int(m_local_id.group(1)))
            else:
                rank_id = f"rank_{get_next_free_rank_num()}"

            codepoint = get_next_free_codepoint()
            new_assigned_count += 1

        retained_tags.append({
            "id": rank_id,
            "name": title,
            "displayName": chr(codepoint),
            "color": "#FFFFFF",
            "preview": preview
        })

    # 7. Save the updated rank_tags.json
    os.makedirs(os.path.dirname(rank_tags_path), exist_ok=True)
    with open(rank_tags_path, "w", encoding="utf-8") as f:
        json.dump(retained_tags, f, ensure_ascii=False, indent=2)

    print(f"Preserved {pushed_preserved_count} pushed rank tags.")
    print(f"Assigned new unique unicodes to {new_assigned_count} new rank tags.")
    print(f"Successfully wrote {len(retained_tags)} rank tags to {rank_tags_path}")

if __name__ == "__main__":
    main()
