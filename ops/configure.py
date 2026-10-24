"""Configure local secrets without putting them into chat or shell history."""
import getpass
import os
from pathlib import Path
import secrets

root=Path(__file__).resolve().parents[1]
path=root/'.env'
values={}
source=path if path.exists() else root/'.env.example'
for line in source.read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        key,value=line.split('=',1);values[key]=value
values['SECRET_KEY']=values.get('SECRET_KEY') if len(values.get('SECRET_KEY',''))>=40 else secrets.token_urlsafe(48)
groups={'1':['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET'],'2':['OPENAI_API_KEY','OPENAI_MODEL'],'3':['RESEND_API_KEY','MAIL_FROM'],'4':['MAPTILER_KEY']}
print('1 Google login | 2 OpenAI assistant | 3 Email | 4 MapTiler | 0 Save local defaults')
choice=input('Choose one service to configure: ').strip()
for key in groups.get(choice,[]):
    secret='SECRET' in key or 'KEY' in key
    prompt=f'{key} (Enter keeps existing value): '
    value=getpass.getpass(prompt) if secret else input(prompt)
    if value.strip():values[key]=value.strip()
path.write_text('\n'.join(f'{key}={value}' for key,value in values.items())+'\n')
os.chmod(path,0o600)
print('Saved to .env. Secrets are not displayed. Restart API and worker to apply changes.')
print('Configured:',', '.join(k for k in ['GOOGLE_CLIENT_ID','OPENAI_API_KEY','RESEND_API_KEY','MAPTILER_KEY'] if values.get(k)) or 'local defaults only')
