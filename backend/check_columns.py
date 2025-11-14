"""
Check if new columns exist in the database
"""
import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection

def check_table_columns():
    with connection.cursor() as cursor:
        # Get all columns from the notification table
        cursor.execute("DESCRIBE api_boundaryviolationnotification")
        columns = cursor.fetchall()
        
        print("=" * 70)
        print("DATABASE TABLE COLUMNS - api_boundaryviolationnotification")
        print("=" * 70)
        print()
        
        column_names = [col[0] for col in columns]
        
        # Check for new fields
        new_fields = [
            'report_number',
            'report_status',
            'remarks',
            'status_updated_at',
            'status_updated_by_id',
            'timestamp_start',
            'timestamp_end',
            'idle_minutes',
            'contact_person_name',
            'contact_person_phone',
            'owner_name',
            'registration_number'
        ]
        
        print("📋 EXISTING COLUMNS:")
        for col in columns:
            print(f"   ✅ {col[0]:<30} {col[1]}")
        
        print()
        print("=" * 70)
        print("🔍 NEW ENHANCED FIELDS STATUS:")
        print("=" * 70)
        print()
        
        all_exist = True
        for field in new_fields:
            exists = field in column_names
            status = "✅ EXISTS" if exists else "❌ MISSING"
            print(f"   {field:<30} {status}")
            if not exists:
                all_exist = False
        
        print()
        print("=" * 70)
        
        if all_exist:
            print("✅ ALL NEW FIELDS EXIST IN DATABASE")
            print("   Backend should work correctly!")
        else:
            print("❌ SOME FIELDS ARE MISSING")
            print("   Need to manually add columns to database")
        
        print("=" * 70)
        return all_exist

if __name__ == "__main__":
    try:
        check_table_columns()
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
