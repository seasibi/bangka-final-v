import sys
import os
import shutil
import subprocess
from datetime import datetime

# === Setup Django environment ===
BASE_DIR = os.path.abspath(os.path.dirname(__file__))  # project-root
sys.path.insert(0, BASE_DIR)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")


import django
from django.core.mail import send_mail
django.setup()

print("Scheduled backup script is running...")
print("Backup script started")

# === Backup directories ===
BACKUP_DIR = os.path.join(BASE_DIR, 'backups')
os.makedirs(BACKUP_DIR, exist_ok=True)
print(f"Backups folder created at: {BACKUP_DIR}")

FOLDERS_TO_BACKUP = [
    os.path.join(BASE_DIR, 'media'),
    os.path.join(BASE_DIR, 'api'),
]

# === MySQL settings ===
MYSQLDUMP_PATH = r"C:\xampp\mysql\bin\mysqldump.exe"  # <-- adjust if needed
MYSQL_USER = "root"
MYSQL_PASSWORD = ""   # leave empty if no password
MYSQL_DB = "db_banka"
MYSQL_HOST = "localhost"
MYSQL_PORT = "3306"

# === Timestamped backup subfolder ===
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
backup_subdir = os.path.join(BACKUP_DIR, f"backup_{timestamp}")
os.makedirs(backup_subdir, exist_ok=True)

# === Collect logs ===
logs = []

# === Folder backup ===
def backup_folder(src, dest):
    try:
        if os.path.exists(src):
            shutil.copytree(src, dest)
            msg = f"Copied folder: {src} -> {dest}"
        else:
            msg = f"Warning: {src} does not exist, skipping."
    except Exception as e:
        msg = f"Error copying folder {src}: {e}"
    print(msg)
    logs.append(msg)

# === MySQL backup ===
def backup_mysql(user, password, db, host, port, dest_path):
    try:
        cmd = [
            MYSQLDUMP_PATH,
            f"--user={user}",
            f"--host={host}",
            f"--port={port}",
            db,
        ]
        if password:  # add password only if not empty
            cmd.insert(1, f"--password={password}")

        with open(dest_path, "w", encoding="utf-8") as f:
            subprocess.run(cmd, stdout=f, check=True)
        msg = f"MySQL dump created: {dest_path}"
    except Exception as e:
        msg = f"Error dumping MySQL database {db}: {e}"
    print(msg)
    logs.append(msg)

# === Email notification ===
def send_backup_email(success, logs):
    subject = "[Bangka] Backup " + ("Success ✅" if success else "Failed ❌")
    message = "\n".join(logs)

    try:
        send_mail(
            subject,
            message,
            None,  # uses DEFAULT_FROM_EMAIL from settings.py
            ["bangka.elyu@gmail.com"],  # <-- change to recipient(s)
            fail_silently=False,
        )
        print("Backup email sent!")
    except Exception as e:
        print(f"Error sending email: {e}")

# === Run backup process ===
for folder in FOLDERS_TO_BACKUP:
    dest = os.path.join(backup_subdir, os.path.basename(folder))
    backup_folder(folder, dest)

dump_file = os.path.join(backup_subdir, f"{MYSQL_DB}_backup.sql")
backup_mysql(MYSQL_USER, MYSQL_PASSWORD, MYSQL_DB, MYSQL_HOST, MYSQL_PORT, dump_file)

final_msg = f"Backup completed. Files saved in {backup_subdir}"
print(final_msg)
logs.append(final_msg)

# === Send email summary ===
success = not any("Error" in line for line in logs)
send_backup_email(success, logs)
