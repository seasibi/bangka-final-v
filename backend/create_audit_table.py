"""
Create ViolationStatusAuditLog table
"""
import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection

def create_audit_table():
    print("=" * 70)
    print("🔧 CREATING AUDIT LOG TABLE")
    print("=" * 70)
    print()
    
    with connection.cursor() as cursor:
        # Check if table exists
        cursor.execute("""
            SELECT COUNT(*)
            FROM information_schema.tables 
            WHERE table_schema = DATABASE()
            AND table_name = 'api_violationstatusauditlog'
        """)
        exists = cursor.fetchone()[0] > 0
        
        if exists:
            print("   ⏭️  Table api_violationstatusauditlog already exists")
            return
        
        # Create the table (without foreign key to user for now - can add later)
        create_sql = """
        CREATE TABLE api_violationstatusauditlog (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            violation_id BIGINT NOT NULL,
            user_id INT NULL,
            user_role VARCHAR(100) NOT NULL,
            old_status VARCHAR(50) NOT NULL,
            new_status VARCHAR(50) NOT NULL,
            old_remarks LONGTEXT,
            new_remarks LONGTEXT,
            remarks_changed TINYINT(1) DEFAULT 0,
            timestamp DATETIME(6) NOT NULL,
            ip_address VARCHAR(39) NULL,
            user_agent LONGTEXT,
            FOREIGN KEY (violation_id) REFERENCES api_boundaryviolationnotification(id) ON DELETE CASCADE,
            INDEX idx_violation_timestamp (violation_id, timestamp DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
        
        try:
            cursor.execute(create_sql)
            print("   ✅ Created table: api_violationstatusauditlog")
        except Exception as e:
            print(f"   ❌ Error creating table: {e}")
            return
        
        print()
        print("=" * 70)
        print("✅ AUDIT LOG TABLE CREATED!")
        print("=" * 70)
        print()
        print("🎯 Database is fully ready for enhanced notifications!")
        print()
        print("Next steps:")
        print("   1. Restart backend server: python manage.py runserver")
        print("   2. Hard refresh frontend: Ctrl+Shift+R")
        print("   3. Try logging in")
        print("=" * 70)

if __name__ == "__main__":
    try:
        create_audit_table()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
