let allApps = [];

// ── FETCH & RENDER ────────────────────────────────────────
async function loadApplications() {
    const search = document.getElementById('searchInput').value;
    const status = document.getElementById('statusFilter').value;
    let url = `/api/applications?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`;

    const res = await fetch(url);
    const data = await res.json();

    allApps = data.applications;
    updateStats(data.stats);
    renderTable(allApps);
}

function updateStats(stats) {
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-interviews').textContent = stats.interviews;
    document.getElementById('stat-selected').textContent = stats.selected;
    document.getElementById('stat-rejected').textContent = stats.rejected;
}

function renderTable(apps) {
    const tbody = document.getElementById('appTableBody');
    if (!apps.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="fa-solid fa-inbox"></i><br>No applications found.</td></tr>`;
        return;
    }
    tbody.innerHTML = apps.map((a, i) => `
        <tr>
            <td>${i + 1}</td>
            <td class="company-cell">${esc(a.company_name)}</td>
            <td>${esc(a.job_title)}</td>
            <td>${esc(a.location || '—')}</td>
            <td>${formatDate(a.application_date)}</td>
            <td>
                ${a.job_portal ? `<span>${esc(a.job_portal)}</span>` : '—'}
                ${a.job_link ? `<a href="${esc(a.job_link)}" target="_blank" class="link-icon" style="margin-left:6px"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ''}
            </td>
            <td>${statusBadge(a.status)}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon btn-view" onclick="viewApp(${a.id})" title="View"><i class="fa-solid fa-eye"></i></button>
                    <button class="btn-icon btn-edit" onclick="editApp(${a.id})" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-icon btn-delete" onclick="deleteApp(${a.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ── HELPERS ───────────────────────────────────────────────
function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(d) {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

function statusBadge(status) {
    const map = {
        'Applied': 'applied', 'Interview Scheduled': 'interview',
        'Technical Round': 'technical', 'HR Round': 'hr',
        'Selected': 'selected', 'Rejected': 'rejected'
    };
    return `<span class="badge badge-${map[status] || 'applied'}">${esc(status)}</span>`;
}

// ── MODAL ─────────────────────────────────────────────────
function openModal(app = null) {
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById('modalTitle').textContent = app ? 'Edit Application' : 'Add Application';
    document.getElementById('editId').value = app ? app.id : '';
    document.getElementById('company_name').value = app ? app.company_name : '';
    document.getElementById('job_title').value = app ? app.job_title : '';
    document.getElementById('location').value = app ? (app.location || '') : '';
    document.getElementById('application_date').value = app ? app.application_date.split('T')[0].split(' ')[0] : new Date().toISOString().split('T')[0];
    document.getElementById('job_portal').value = app ? (app.job_portal || '') : '';
    document.getElementById('job_link').value = app ? (app.job_link || '') : '';
    document.getElementById('status').value = app ? app.status : 'Applied';
    document.getElementById('notes').value = app ? (app.notes || '') : '';
}

function closeModal(e) {
    if (e.target === document.getElementById('modalOverlay')) closeModalDirect();
}
function closeModalDirect() {
    document.getElementById('modalOverlay').classList.remove('active');
}

// ── FORM SUBMIT ───────────────────────────────────────────
document.getElementById('appForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const payload = {
        company_name: document.getElementById('company_name').value,
        job_title: document.getElementById('job_title').value,
        location: document.getElementById('location').value,
        application_date: document.getElementById('application_date').value,
        job_portal: document.getElementById('job_portal').value,
        job_link: document.getElementById('job_link').value,
        status: document.getElementById('status').value,
        notes: document.getElementById('notes').value
    };

    const url = id ? `/api/applications/${id}` : '/api/applications';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
        closeModalDirect();
        loadApplications();
    }
});

// ── VIEW ──────────────────────────────────────────────────
function viewApp(id) {
    const app = allApps.find(a => a.id === id);
    if (!app) return;
    document.getElementById('viewModalBody').innerHTML = `
        <div class="view-grid">
            <div class="view-field"><label>Company</label><span>${esc(app.company_name)}</span></div>
            <div class="view-field"><label>Job Title</label><span>${esc(app.job_title)}</span></div>
            <div class="view-field"><label>Location</label><span>${esc(app.location || '—')}</span></div>
            <div class="view-field"><label>Date Applied</label><span>${formatDate(app.application_date)}</span></div>
            <div class="view-field"><label>Portal</label><span>${esc(app.job_portal || '—')}</span></div>
            <div class="view-field"><label>Status</label><span>${statusBadge(app.status)}</span></div>
            ${app.job_link ? `<div class="view-field full"><label>Job Link</label><span><a href="${esc(app.job_link)}" target="_blank" style="color:var(--accent)">${esc(app.job_link)}</a></span></div>` : ''}
            ${app.notes ? `<div class="view-field full"><label>Notes</label><div class="view-notes">${esc(app.notes)}</div></div>` : ''}
        </div>
    `;
    document.getElementById('viewModalOverlay').classList.add('active');
}

function closeViewModal(e) {
    if (e.target === document.getElementById('viewModalOverlay'))
        document.getElementById('viewModalOverlay').classList.remove('active');
}

// ── EDIT ──────────────────────────────────────────────────
function editApp(id) {
    const app = allApps.find(a => a.id === id);
    if (app) openModal(app);
}

// ── DELETE ────────────────────────────────────────────────
async function deleteApp(id) {
    if (!confirm('Delete this application? This cannot be undone.')) return;
    const res = await fetch(`/api/applications/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) loadApplications();
}

// ── SEARCH & FILTER ───────────────────────────────────────
let searchTimer;
document.getElementById('searchInput').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadApplications, 350);
});
document.getElementById('statusFilter').addEventListener('change', loadApplications);
document.getElementById('searchBtn').addEventListener('click', loadApplications);

// ── INIT ──────────────────────────────────────────────────
loadApplications();
