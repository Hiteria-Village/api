"""
Generate individual HTML pages for each song to enable proper Discord embeds.
Run this script whenever tracks.json is updated.
"""

import json
import os
from pathlib import Path

def generate_song_pages():
    with open('data/tracks.json', 'r', encoding='utf-8') as f:
        tracks = json.load(f)
    
    songs_dir = Path('songs')
    songs_dir.mkdir(exist_ok=True)
    
    template = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <meta name="theme-color" content="#000000">
    <meta name="description" content="{description}">
    <meta property="og:title" content="{title} - {artist}">
    <meta property="og:description" content="{description}">
    <meta property="og:type" content="music.song">
    <meta property="og:image" content="{image_url}">
    <meta property="og:url" content="https://hiteriavillage.github.io/songs/{identifier}.html">
    <meta property="og:site_name" content="Hiteria Village">
    <meta property="music:musician" content="{artist}">
    <meta property="music:release_date" content="{release_year}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{title} - {artist}">
    <meta name="twitter:description" content="{description}">
    <meta name="twitter:image" content="{image_url}">
    <title>{title} - {artist} | Hiteria Village</title>
    <script>
        // Redirect to tracks page with hash
        window.location.href = "../tracks.html#{identifier}";
    </script>
</head>
<body>
    <p>Redirecting to <a href="../tracks.html#{identifier}">{title} - {artist}</a>...</p>
</body>
</html>'''
    
    for identifier, track in tracks.items():
        title = track.get('title', 'Unknown')
        artist = track.get('artist', 'Unknown')
        genre = track.get('genre', 'Music')
        duration = track.get('duration', 'N/A')
        release_year = track.get('releaseYear', 'N/A')
        cover = track.get('cover', '')
        
        description = f"{genre} • {duration} • {release_year}"
        
        if cover:
            image_url = f"https://hiteriavillage.com/assets/covers/{cover}"
        else:
            image_url = "https://hiteriavillage.com/assets/images/logo.png"
        
        html = template.format(
            identifier=identifier,
            title=title,
            artist=artist,
            description=description,
            image_url=image_url,
            release_year=release_year
        )
        
        output_file = songs_dir / f"{identifier}.html"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html)
        
        print(f"Generated: {output_file}")
    
    print(f"\nTotal songs generated: {len(tracks)}")
    print("\nNow you can share links like:")
    print("https://hiteriavillage.com/songs/crazy.html")
    print("\nThese will show proper embeds on Discord and redirect users to the main page.")

if __name__ == '__main__':
    generate_song_pages()
