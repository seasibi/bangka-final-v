try:
    import pymysql  # Pure-Python MySQL driver (avoids VC++ build tools on Windows)
    pymysql.install_as_MySQLdb()
except Exception:
    # Fallback: if PyMySQL not available, Django will try mysqlclient
    pass