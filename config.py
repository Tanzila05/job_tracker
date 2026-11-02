class Config:
    SECRET_KEY = 'your_super_secret_key_change_this'
    MYSQL_HOST = 'localhost'
    MYSQL_USER = 'root'
    MYSQL_PASSWORD = '12345'
    MYSQL_DB = 'job_tracker'
    MYSQL_CURSORCLASS = 'DictCursor'
    SESSION_TYPE = 'filesystem'