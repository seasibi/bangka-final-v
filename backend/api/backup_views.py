import os
import subprocess
import datetime
from django.http import HttpResponse, JsonResponse
from django.conf import settings
from django.views.decorators.http import require_http_methods
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from .permissions import IsAdmin
from django.core.files.storage import default_storage
import json


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdmin])
def create_backup(request):
    """
    Create a database backup using mysqldump
    """
    try:
        # Get database settings from Django settings
        db_settings = settings.DATABASES['default']
        db_name = db_settings['NAME']
        db_user = db_settings['USER']
        db_password = db_settings['PASSWORD']
        db_host = db_settings.get('HOST', 'localhost')
        db_port = db_settings.get('PORT', '3306')
        
        # Create backup filename with timestamp
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f'database_backup_{timestamp}.sql'
        backup_dir = os.path.join(settings.BASE_DIR, 'backups')
        
        # Create backups directory if it doesn't exist
        os.makedirs(backup_dir, exist_ok=True)
        
        backup_path = os.path.join(backup_dir, backup_filename)
        
        # Construct mysqldump command
        # For Windows, use the full path if mysqldump is not in PATH
        mysqldump_path = r'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe'
        
        # Execute mysqldump
        # Set MySQL password as environment variable to handle special characters
        env = os.environ.copy()
        env['MYSQL_PWD'] = db_password
        
        mysqldump_cmd = [
            mysqldump_path,
            f'--host={db_host}',
            f'--port={db_port}',
            f'--user={db_user}',
            '--single-transaction',
            '--routines',
            '--triggers',
            db_name
        ]
        
        with open(backup_path, 'w') as backup_file:
            process = subprocess.Popen(
                mysqldump_cmd,
                stdout=backup_file,
                stderr=subprocess.PIPE,
                text=True,
                env=env
            )
            _, stderr = process.communicate()
            
            if process.returncode != 0:
                return JsonResponse({
                    'error': f'Backup failed: {stderr}'
                }, status=500)
        
        # Read the backup file and send it as download
        with open(backup_path, 'rb') as backup_file:
            response = HttpResponse(backup_file.read(), content_type='application/sql')
            response['Content-Disposition'] = f'attachment; filename="{backup_filename}"'
            
        # Log the backup activity
        from .models import ActivityLog
        ActivityLog.objects.create(
            user=request.user,
            action=f'DATABASE_BACKUP: {backup_filename}'
        )
        
        return response
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"\n=== BACKUP ERROR ===")
        print(error_details)
        print(f"===================\n")
        return JsonResponse({
            'error': f'Backup error: {str(e)}',
            'details': error_details
        }, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdmin])
def restore_backup(request):
    """
    Smart restore: Analyzes backup and imports only new/missing data without dropping database
    Supports 'mode' parameter: 'smart' (default) or 'full'
    """
    try:
        if 'backup_file' not in request.FILES:
            return JsonResponse({
                'error': 'No backup file provided'
            }, status=400)
        
        backup_file = request.FILES['backup_file']
        
        # Validate file extension
        if not backup_file.name.endswith('.sql'):
            return JsonResponse({
                'error': 'Invalid file type. Please upload a .sql file'
            }, status=400)
        
        # Check restore mode
        restore_mode = request.POST.get('mode', 'smart').strip().lower()
        is_smart_restore = (restore_mode == 'smart')
        
        # Get database settings
        db_settings = settings.DATABASES['default']
        db_name = db_settings['NAME']
        db_user = db_settings['USER']
        db_password = db_settings['PASSWORD']
        db_host = db_settings.get('HOST', 'localhost')
        db_port = db_settings.get('PORT', '3306')
        
        # Save uploaded file temporarily
        temp_dir = os.path.join(settings.BASE_DIR, 'temp')
        os.makedirs(temp_dir, exist_ok=True)
        
        # Use a safe filename to avoid issues with spaces and special chars
        import uuid
        safe_filename = f'restore_{uuid.uuid4().hex}.sql'
        temp_file_path = os.path.join(temp_dir, safe_filename)
        
        # Write file completely and close it
        try:
            with open(temp_file_path, 'wb') as destination:
                # Read entire file into memory first to avoid file handle issues
                file_content = backup_file.read()
                destination.write(file_content)
                destination.flush()  # Ensure all data is written
                os.fsync(destination.fileno())  # Force write to disk
        except Exception as write_error:
            return JsonResponse({
                'error': f'Failed to save backup file: {str(write_error)}'
            }, status=500)
        
        # File is now fully written, flushed, and closed
        # Give Windows a moment to release file handle
        import time
        import re
        from django.db import connection
        time.sleep(0.1)
        
        # Construct mysql restore command
        mysql_path = r'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe'
        
        # Execute mysql restore
        # Set MySQL password as environment variable to handle special characters
        env = os.environ.copy()
        env['MYSQL_PWD'] = db_password
        
        # Process the SQL file based on restore mode
        processed_file_path = temp_file_path
        
        if is_smart_restore:
            # SMART RESTORE: Analyze backup and import only new/missing data
            print(f"\n=== SMART RESTORE: Analyzing backup file ===")
            
            # Parse SQL file to extract INSERT statements
            import_summary = {}
            cursor = connection.cursor()
            
            with open(temp_file_path, 'r', encoding='utf-8', errors='ignore') as source:
                current_table = None
                current_insert = ''
                
                for line in source:
                    line = line.strip()
                    
                    # Detect INSERT INTO statements
                    if line.startswith('INSERT INTO'):
                        # Extract table name
                        match = re.match(r'INSERT INTO `?([\w_]+)`?', line)
                        if match:
                            current_table = match.group(1)
                            current_insert = line
                            
                            # If this is a complete INSERT statement (ends with ;)
                            if line.endswith(';'):
                                try:
                                    # Try to execute with INSERT IGNORE to skip duplicates
                                    safe_insert = current_insert.replace('INSERT INTO', 'INSERT IGNORE INTO', 1)
                                    cursor.execute(safe_insert)
                                    affected = cursor.rowcount
                                    
                                    if current_table not in import_summary:
                                        import_summary[current_table] = 0
                                    import_summary[current_table] += affected
                                    
                                except Exception as e:
                                    print(f"Warning: Could not insert into {current_table}: {str(e)[:100]}")
                                
                                current_insert = ''
                                current_table = None
                    
                    # Continue multi-line INSERT statements
                    elif current_insert and not line.startswith('--'):
                        current_insert += ' ' + line
                        
                        # Check if INSERT statement is complete
                        if line.endswith(';'):
                            try:
                                safe_insert = current_insert.replace('INSERT INTO', 'INSERT IGNORE INTO', 1)
                                cursor.execute(safe_insert)
                                affected = cursor.rowcount
                                
                                if current_table not in import_summary:
                                    import_summary[current_table] = 0
                                import_summary[current_table] += affected
                                
                            except Exception as e:
                                print(f"Warning: Could not insert into {current_table}: {str(e)[:100]}")
                            
                            current_insert = ''
                            current_table = None
            
            connection.commit()
            cursor.close()
            
            # Filter out tables with 0 new records
            import_summary = {k: v for k, v in import_summary.items() if v > 0}
            
            print(f"Smart restore complete. Summary: {import_summary}")
            
            # Log the restore activity
            from .models import ActivityLog
            summary_text = ', '.join([f"{table}: +{count}" for table, count in import_summary.items()])
            ActivityLog.objects.create(
                user=request.user,
                action=f'SMART_RESTORE: {backup_file.name} - Imported: {summary_text or "No new data"}'
            )
            
            # Clean up temp file
            try:
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
            except:
                pass
            
            return JsonResponse({
                'message': 'Smart restore completed successfully',
                'mode': 'smart',
                'imported': import_summary,
                'total_new_records': sum(import_summary.values())
            })
        else:
            # FULL RESTORE: Drop and recreate database
            print(f"\n=== DROPPING AND RECREATING DATABASE {db_name} ===")
            drop_create_cmd = [
                mysql_path,
                f'--host={db_host}',
                f'--port={db_port}',
                f'--user={db_user}',
                '--execute',
                f'DROP DATABASE IF EXISTS {db_name}; CREATE DATABASE {db_name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'
            ]
            
            print(f"Running: {' '.join(drop_create_cmd[:-1])} [SQL COMMAND]")
            
            # Execute drop and create
            drop_process = subprocess.run(
                drop_create_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env
            )
            
            print(f"Drop/Create stdout: {drop_process.stdout}")
            print(f"Drop/Create stderr: {drop_process.stderr}")
            print(f"Drop/Create return code: {drop_process.returncode}")
            
            if drop_process.returncode != 0:
                return JsonResponse({
                    'error': f'Failed to prepare database: {drop_process.stderr}'
                }, status=500)
        
            # Now restore the full backup
            print(f"\n=== RESTORING FULL BACKUP TO {db_name} ===")
            mysql_cmd = [
                mysql_path,
                f'--host={db_host}',
                f'--port={db_port}',
                f'--user={db_user}',
                '--force',  # Continue even if SQL errors occur
                db_name
            ]
            print(f"Running: {' '.join(mysql_cmd)}")
            
            with open(processed_file_path, 'r', encoding='utf-8') as sql_file:
                process = subprocess.Popen(
                    mysql_cmd,
                    stdin=sql_file,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    env=env
                )
                _, stderr = process.communicate()
            
            # File is now closed, check return code
            if process.returncode != 0:
                # Clean up temp file
                try:
                    if os.path.exists(temp_file_path):
                        import time
                        time.sleep(0.5)  # Wait for Windows to release file handle
                        os.remove(temp_file_path)
                except:
                    pass  # Ignore cleanup errors
                    
                return JsonResponse({
                    'error': f'Restore failed: {stderr}'
                }, status=500)
            
            # Log the restore activity
            from .models import ActivityLog
            ActivityLog.objects.create(
                user=request.user,
                action=f'FULL_RESTORE: {backup_file.name}'
            )
            
            # Clean up temp files - ignore errors if file is locked
            try:
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
            except:
                pass  # File will be cleaned up later or on next run
            
            return JsonResponse({
                'message': 'Full database restore completed successfully',
                'mode': 'full'
            })
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"\n=== RESTORE ERROR ===")
        print(error_details)
        print(f"===================\n")
        return JsonResponse({
            'error': f'Restore error: {str(e)}',
            'details': error_details
        }, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def backup_history(request):
    """
    Get list of available backups
    """
    try:
        backup_dir = os.path.join(settings.BASE_DIR, 'backups')
        
        if not os.path.exists(backup_dir):
            return JsonResponse({'backups': []})
        
        backups = []
        for filename in os.listdir(backup_dir):
            if filename.endswith('.sql'):
                file_path = os.path.join(backup_dir, filename)
                file_stat = os.stat(file_path)
                
                backups.append({
                    'filename': filename,
                    'date': datetime.datetime.fromtimestamp(file_stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                    'size': f'{file_stat.st_size / (1024 * 1024):.2f} MB',
                    'status': 'Available'
                })
        
        # Sort by date descending
        backups.sort(key=lambda x: x['date'], reverse=True)
        
        return JsonResponse({'backups': backups})
        
    except Exception as e:
        return JsonResponse({
            'error': f'Error retrieving backup history: {str(e)}'
        }, status=500)
