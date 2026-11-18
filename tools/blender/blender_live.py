"""Run a script in the owner's open Blender through the Blender Lab MCP add-on socket (localhost:9876).

Usage: python3 -I blender_live.py <script.py>
The script may fill the `result` dict; `TOOLS_DIR` is set to the script's folder so it can import siblings.
"""
import json
import os
import socket
import sys

path = os.path.abspath(sys.argv[1])
preamble = f'TOOLS_DIR = {os.path.dirname(path)!r}\n'
code = preamble + open(path).read()
with socket.create_connection(('127.0.0.1', 9876), timeout=300) as s:
    s.sendall((json.dumps({'type': 'execute', 'code': code, 'strict_json': False}) + '\0').encode())
    data = b''
    while b'\0' not in data:
        chunk = s.recv(65536)
        if not chunk:
            raise SystemExit('Blender closed the connection without a reply')
        data += chunk
reply = json.loads(data.split(b'\0')[0])
print(json.dumps(reply, indent=1, ensure_ascii=False)[:4000])
if reply.get('status') != 'ok':
    raise SystemExit(1)
