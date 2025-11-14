"""
Manually add missing columns to database
"""
import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection

def add_missing_columns():
    print("=" * 70)
    print("🔧 ADDING MISSING COLUMNS TO DATABASE")
    print("=" * 70)
    print()
    
    with connection.cursor() as cursor:
        # Add missing columns one by one
        columns_to_add = [
            ("report_number", "VARCHAR(50) NULL"),
            ("report_status", "VARCHAR(50) DEFAULT 'Not Reported'"),
            ("status_updated_at", "DATETIME(6) NULL"),
            ("status_updated_by_id", "INT NULL"),
            ("timestamp_start", "DATETIME(6) NULL"),
            ("timestamp_end", "DATETIME(6) NULL"),
        ]
        
        for col_name, col_def in columns_to_add:
            try:
                sql = f"ALTER TABLE api_boundaryviolationnotification ADD COLUMN {col_name} {col_def}"
                cursor.execute(sql)
                print(f"   ✅ Added column: {col_name}")
            except Exception as e:
                if "Duplicate column" in str(e):
                    print(f"   ⏭️  Column {col_name} already exists, skipping")
                else:
                    print(f"   ❌ Error adding {col_name}: {e}")
        
        print()
        print("=" * 70)
        print("✅ DATABASE COLUMNS UPDATED!")
        print("=" * 70)
        print()
        print("🔍 Verifying columns...")
        
        # Verify
        cursor.execute("DESCRIBE api_boundaryviolationnotification")
        columns = cursor.fetchall()
        column_names = [col[0] for col in columns]
        
        new_fields = [
            'report_number',
            'report_status', 
            'status_updated_at',
            'status_updated_by_id',
            'timestamp_start',
            'timestamp_end'
        ]
        
        all_exist = True
        for field in new_fields:
            exists = field in column_names
            status = "✅" if exists else "❌"
            print(f"   {status} {field}")
            if not exists:
                all_exist = False
        
        print()
        if all_exist:
            print("✅ ALL COLUMNS VERIFIED - Database is ready!")
            print()
            print("🎯 Next steps:")
            print("   1. Restart your backend server")
            print("   2. Hard refresh frontend (Ctrl+Shift+R)")
            print("   3. Try logging in again")
        else:
            print("❌ Some columns still missing")
        
        print("=" * 70)

if __name__ == "__main__":
    try:
        add_missing_columns()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
