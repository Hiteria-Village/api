import os, json, subprocess

folder = r'G:\My Drive\Octave\Song Files\deadmau5, Gerard Way - Professional Griefers'
with open(os.path.join(folder, 'info.json')) as f:
    info = json.load(f)

stems = info.get('stems', {})
print('Stems in info.json:')
for name, file in stems.items():
    full = os.path.join(folder, file)
    print(f'  {name}: {file} -> exists={os.path.isfile(full)}')

print()
print('All files in folder:')
for fn in os.listdir(folder):
    full = os.path.join(folder, fn)
    if os.path.isfile(full):
        print(f'  {fn}')

ffmpeg = r'C:\Users\jayde\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin\ffmpeg.exe'
stem_files = [os.path.join(folder, v) for v in stems.values() if os.path.isfile(os.path.join(folder, v))]
print(f'\nStem files to mix: {len(stem_files)}')
for s in stem_files:
    r = subprocess.run([ffmpeg, '-i', s], capture_output=True, text=True)
    for line in r.stderr.splitlines():
        if 'Duration' in line or 'Stream' in line:
            print(f'  {os.path.basename(s)}: {line.strip()}')

with open('tools/_debug_out.txt', 'w') as out:
    out.write('Stems:\n')
    for name, file in stems.items():
        full = os.path.join(folder, file)
        out.write(f'  {name}: {file} exists={os.path.isfile(full)}\n')
    out.write(f'\nCount: {len(stem_files)}\n')
    for s in stem_files:
        r = subprocess.run([ffmpeg, '-i', s], capture_output=True, text=True)
        for line in r.stderr.splitlines():
            if 'Duration' in line or 'Stream' in line:
                out.write(f'  {os.path.basename(s)}: {line.strip()}\n')
print('Written to tools/_debug_out.txt')
