from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from flask_mysqldb import MySQL
from flask_bcrypt import Bcrypt
import re

app = Flask(__name__)
app.config.from_object('config.Config')

mysql = MySQL(app)
bcrypt = Bcrypt(app)


def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated


# ─── AUTH ROUTES ───────────────────────────────────────────────────────────────

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username'].strip()
        email = request.form['email'].strip()
        password = request.form['password']

        if not username or not email or not password:
            return render_template('register.html', error='All fields are required.')

        if not re.match(r'[^@]+@[^@]+\.[^@]+', email):
            return render_template('register.html', error='Invalid email address.')

        if len(password) < 6:
            return render_template('register.html', error='Password must be at least 6 characters.')

        cur = mysql.connection.cursor()
        cur.execute("SELECT id FROM users WHERE email=%s OR username=%s", (email, username))
        existing = cur.fetchone()
        if existing:
            cur.close()
            return render_template('register.html', error='Email or username already exists.')

        pw_hash = bcrypt.generate_password_hash(password).decode('utf-8')
        cur.execute("INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s)",
                    (username, email, pw_hash))
        mysql.connection.commit()
        cur.close()
        return redirect(url_for('login'))

    return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email'].strip()
        password = request.form['password']

        cur = mysql.connection.cursor()
        cur.execute("SELECT * FROM users WHERE email=%s", (email,))
        user = cur.fetchone()
        cur.close()

        if user and bcrypt.check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['username'] = user['username']
            return redirect(url_for('dashboard'))
        return render_template('login.html', error='Invalid email or password.')

    return render_template('login.html')


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


# ─── DASHBOARD ─────────────────────────────────────────────────────────────────

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html', username=session['username'])


# ─── API: JOB APPLICATIONS ─────────────────────────────────────────────────────

@app.route('/api/applications', methods=['GET'])
@login_required
def get_applications():
    user_id = session['user_id']
    search = request.args.get('search', '')
    status_filter = request.args.get('status', '')

    cur = mysql.connection.cursor()
    query = "SELECT * FROM job_applications WHERE user_id=%s"
    params = [user_id]

    if search:
        query += " AND (company_name LIKE %s OR job_title LIKE %s)"
        like = f'%{search}%'
        params += [like, like]

    if status_filter:
        query += " AND status=%s"
        params.append(status_filter)

    query += " ORDER BY created_at DESC"
    cur.execute(query, params)
    apps = cur.fetchall()

    # Stats
    cur.execute("SELECT COUNT(*) as total FROM job_applications WHERE user_id=%s", (user_id,))
    total = cur.fetchone()['total']
    cur.execute("SELECT COUNT(*) as c FROM job_applications WHERE user_id=%s AND status IN ('Interview Scheduled','Technical Round','HR Round')", (user_id,))
    interviews = cur.fetchone()['c']
    cur.execute("SELECT COUNT(*) as c FROM job_applications WHERE user_id=%s AND status='Selected'", (user_id,))
    selected = cur.fetchone()['c']
    cur.execute("SELECT COUNT(*) as c FROM job_applications WHERE user_id=%s AND status='Rejected'", (user_id,))
    rejected = cur.fetchone()['c']
    cur.close()

    for a in apps:
        if a.get('application_date'):
            a['application_date'] = str(a['application_date'])
        if a.get('created_at'):
            a['created_at'] = str(a['created_at'])
        if a.get('updated_at'):
            a['updated_at'] = str(a['updated_at'])

    return jsonify({
        'applications': apps,
        'stats': {'total': total, 'interviews': interviews, 'selected': selected, 'rejected': rejected}
    })


@app.route('/api/applications', methods=['POST'])
@login_required
def add_application():
    data = request.json
    user_id = session['user_id']
    cur = mysql.connection.cursor()
    cur.execute("""INSERT INTO job_applications
        (user_id, company_name, job_title, location, application_date, job_portal, job_link, status, notes)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (user_id, data['company_name'], data['job_title'], data.get('location',''),
         data['application_date'], data.get('job_portal',''), data.get('job_link',''),
         data.get('status','Applied'), data.get('notes','')))
    mysql.connection.commit()
    new_id = cur.lastrowid
    cur.close()
    return jsonify({'success': True, 'id': new_id})


@app.route('/api/applications/<int:app_id>', methods=['PUT'])
@login_required
def update_application(app_id):
    data = request.json
    user_id = session['user_id']
    cur = mysql.connection.cursor()
    cur.execute("""UPDATE job_applications SET
        company_name=%s, job_title=%s, location=%s, application_date=%s,
        job_portal=%s, job_link=%s, status=%s, notes=%s
        WHERE id=%s AND user_id=%s""",
        (data['company_name'], data['job_title'], data.get('location',''),
         data['application_date'], data.get('job_portal',''), data.get('job_link',''),
         data.get('status','Applied'), data.get('notes',''), app_id, user_id))
    mysql.connection.commit()
    cur.close()
    return jsonify({'success': True})


@app.route('/api/applications/<int:app_id>', methods=['DELETE'])
@login_required
def delete_application(app_id):
    user_id = session['user_id']
    cur = mysql.connection.cursor()
    cur.execute("DELETE FROM job_applications WHERE id=%s AND user_id=%s", (app_id, user_id))
    mysql.connection.commit()
    cur.close()
    return jsonify({'success': True})


if __name__ == '__main__':
    app.run(debug=True)