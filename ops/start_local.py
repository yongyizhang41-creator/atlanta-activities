"""Run local services from one terminal; Ctrl+C stops only services this launcher starts."""
import os
from pathlib import Path
import signal
import subprocess
import time
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
PY=ROOT/'.venv/bin/python'
LOCAL=ROOT/'.local'
PG=LOCAL/'postgres-runtime/bin'
children=[]
handles=[]

def reachable(url):
    try:
        with urllib.request.urlopen(url,timeout=2) as response:return response.status==200
    except Exception:return False

def run():
    LOCAL.mkdir(exist_ok=True)
    if not PY.exists():raise SystemExit('Create .venv and install apps/api/requirements.lock first (see README).')
    if PG.exists():
        check=subprocess.run([str(PG/'pg_isready'),'-h','127.0.0.1','-p','55432'],capture_output=True)
        if check.returncode:
            subprocess.run([str(PG/'pg_ctl'),'-D',str(LOCAL/'pgdata'),'-l',str(LOCAL/'postgres.log'),'-o','-p 55432 -h 127.0.0.1 -k /private/tmp','start'],check=True)
    subprocess.run([str(PY),'-m','alembic','upgrade','head'],cwd=ROOT/'apps/api',check=True)
    commands=[('api',[str(PY),'-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000'],ROOT/'apps/api','http://127.0.0.1:8000/api/health'),
        ('web',['npm','run','dev'],ROOT/'apps/web','http://localhost:3000/login'),
        ('worker',[str(PY),'-m','app.worker.main','run'],ROOT/'apps/api',None)]
    for name,command,cwd,url in commands:
        if url and reachable(url):print(f'{name}: already running; leaving that process alone.');continue
        log=(LOCAL/f'{name}.log').open('a');handles.append(log)
        child=subprocess.Popen(command,cwd=cwd,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
        children.append((name,child))
    for _ in range(60):
        if reachable('http://localhost:3000/login') and reachable('http://127.0.0.1:8000/api/health'):break
        if any(p.poll() is not None for _,p in children):raise RuntimeError('A service stopped. Check .local/*.log')
        time.sleep(.5)
    else:raise RuntimeError('Services did not become ready. Check .local/*.log')
    print('Open http://localhost:3000 · Ctrl+C stops services started here. Logs: .local/*.log',flush=True)
    while True:
        for name,child in children:
            if child.poll() is not None:raise RuntimeError(f'{name} stopped. Check .local/{name}.log')
        time.sleep(2)

try:run()
except KeyboardInterrupt:print('\nStopping local services…')
finally:
    for name,child in children:
        if child.poll() is None:os.killpg(child.pid,signal.SIGTERM)
    for log in handles:log.close()
