#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
import subprocess
import tempfile
import textwrap
import time

parser = argparse.ArgumentParser(description='Render whole-dialog framing and captions from a demo capture.')
parser.add_argument('source', type=Path)
parser.add_argument('events', type=Path)
parser.add_argument('output', type=Path)
parser.add_argument('--width', type=int, default=1920)
parser.add_argument('--no-zoom', action='store_true')
args = parser.parse_args()
if args.width < 320 or args.width % 2:
    parser.error('--width must be an even integer of at least 320')
log = json.loads(args.events.read_text())
fps = log['fps']
vw, vh = log['viewport']['width'], log['viewport']['height']
height = round(args.width * vh / vw / 2) * 2
band = round(args.width / vw * 64 / 2) * 2
frames = [(0, vw / 2, vh / 2, 1)]
for event in log['events']:
    if event['type'] != 'dialog':
        continue
    box = event['box']
    t = event['t'] / 1000
    if box:
        zoom = max(1, min(1.6, vw / (box['width'] + 80), vh / (box['height'] + 80)))
        halfw, halfh = vw / zoom / 2, vh / zoom / 2
        x = min(max(box['x'] + box['width'] / 2, halfw), vw - halfw)
        y = min(max(box['y'] + box['height'] / 2, halfh), vh - halfh)
    else:
        x, y, zoom = vw / 2, vh / 2, 1
    if (x, y, zoom) != frames[-1][1:]:
        frames.append((t, x, y, zoom))


def camera(index):
    current = frames[0][index]
    expression = f'{current:.6f}'
    for i, (start, *_) in enumerate(frames[1:], 1):
        previous = frames[i - 1][index]
        target = frames[i][index]
        duration = 0.28 if frames[i][3] == 1 else 0.55
        if i + 1 < len(frames):
            duration = min(duration, max(0.001, frames[i + 1][0] - start))
        u = f'clip((on/{fps}-{start:.4f})/{duration:.4f},0,1)'
        eased = f'({u}*{u}*(3-2*{u}))'
        expression = f'{expression}+({target - previous:.6f})*{eased}'
    return expression


captions = []
for i, event in enumerate(log['events']):
    if event['type'] == 'caption':
        end = next((e['t'] for e in log['events'][i + 1:] if e['type'] in ('captionClear', 'caption', 'end')), log['end'])
        captions.append((event['t'] / 1000, end / 1000, event['text']))
started = time.monotonic()
with tempfile.TemporaryDirectory(prefix='demo-render-') as tmp:
    filters = []
    if not args.no_zoom and len(frames) > 1:
        x, y, zoom = camera(1), camera(2), camera(3)
        filters.append(f"zoompan=z='{zoom}':x='({x})*iw/{vw}-iw/zoom/2':y='({y})*ih/{vh}-ih/zoom/2':d=1:s={args.width}x{height}:fps={fps}")
    else:
        filters.append(f'scale={args.width}:{height}:flags=lanczos')
    filters.append(f'pad={args.width}:{height + band}:0:0:color=0x0f172a')
    if captions:
        font = subprocess.check_output(['fc-match', '-f', '%{file}', 'sans:semibold'], text=True)
        for i, (start, end, caption) in enumerate(captions):
            path = Path(tmp) / f'caption-{i}.txt'
            path.write_text(textwrap.fill(caption, width=100))
            filters.append(f"drawtext=fontfile='{font}':textfile='{path}':expansion=none:fontsize={round(18 * args.width / vw)}:fontcolor=white:line_spacing=6:x=(w-text_w)/2:y={height}+(h-{height}-text_h)/2:enable='gte(t,{start:.4f})*lt(t,{end:.4f})'")
    filters.append('format=yuv420p')
    graph = Path(tmp) / 'filter.txt'
    graph.write_text(','.join(filters))
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(args.source), '-/filter:v', str(graph), '-an', '-c:v', 'libx264', '-threads', '2', '-preset', 'slow', '-crf', '20', '-movflags', '+faststart', str(args.output)], check=True)
print(f'RENDER {args.output} zoom={int(not args.no_zoom)} cameras={len(frames)} captions={len(captions)} wall={time.monotonic() - started:.2f}s bytes={args.output.stat().st_size}')
