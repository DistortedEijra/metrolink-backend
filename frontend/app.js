/* ============================================================
   Metrolink FOMS — Single-Page Application
   API base: <origin>/metrolink-backend/api (same Tomcat instance
   serves both the frontend and the backend WAR, so this works
   unchanged for localhost and for any deployed domain).
   ============================================================ */

const API = window.location.origin + '/metrolink-backend/api';
let currentPage = 'trips';

// ── Auth helpers ───────────────────────────────────────────
// sessionStorage (not localStorage): login does not persist across app/browser restarts.
const getToken  = () => sessionStorage.getItem('ml_token');
const getUser   = () => JSON.parse(sessionStorage.getItem('ml_user') || 'null');
const isAdmin   = () => getUser()?.role === 'ADMIN';

function saveSession(data) {
  sessionStorage.setItem('ml_token', data.token);
  sessionStorage.setItem('ml_user', JSON.stringify(data));
}
function clearSession() {
  sessionStorage.removeItem('ml_token');
  sessionStorage.removeItem('ml_user');
}

// ── API wrapper ────────────────────────────────────────────
async function api(path, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(API + path, opts);
  } catch (e) {
    toast('Cannot reach server. Is Tomcat running?', 'danger');
    throw e;
  }

  if (res.status === 401) {
    // Login endpoint: parse the server message and let doLogin() show it inline
    if (path === '/auth/login') {
      const json = await res.json();
      throw new Error(json.message || 'Invalid username or password.');
    }
    clearSession(); renderLogin(); throw new Error('Unauthorized');
  }

  const json = await res.json();
  if (!json.success) {
    toast(json.message || 'An error occurred', 'danger');
    throw new Error(json.message);
  }
  return json.data;
}

// ── Toast ──────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const icons = { success: 'fa-check-circle', danger: 'fa-exclamation-circle',
                  warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  const el  = document.getElementById('toast');
  const txt = document.getElementById('toastMsg');
  el.className = `toast align-items-center text-white border-0 bg-${type}`;
  txt.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'} me-2"></i>${msg}`;
  bootstrap.Toast.getOrCreateInstance(el, { delay: 3500 }).show();
}

// ── Custom confirm modal (replaces native confirm()) ───────
function confirmModal(title, message, confirmText = 'Confirm', confirmClass = 'btn-danger') {
  return new Promise(resolve => {
    let modalEl = document.getElementById('_confirmModal');
    if (!modalEl) {
      const div = document.createElement('div');
      div.innerHTML = `
        <div class="modal fade" id="_confirmModal" tabindex="-1" aria-modal="true">
          <div class="modal-dialog modal-sm modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="_confirmTitle"></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body small" id="_confirmBody"></div>
              <div class="modal-footer border-0 pt-1">
                <button class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                <button class="btn btn-sm" id="_confirmOk"></button>
              </div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(div.firstElementChild);
      modalEl = document.getElementById('_confirmModal');
    }
    document.getElementById('_confirmTitle').textContent = title;
    document.getElementById('_confirmBody').textContent  = message;
    const okBtn = document.getElementById('_confirmOk');
    okBtn.textContent = confirmText;
    okBtn.className   = `btn btn-sm ${confirmClass}`;

    const fresh = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(fresh, okBtn);

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    let resolved = false;

    fresh.addEventListener('click', () => { resolved = true; modal.hide(); resolve(true); });
    modalEl.addEventListener('hidden.bs.modal', () => { if (!resolved) resolve(false); }, { once: true });
    modal.show();
  });
}

// ── Format helpers ─────────────────────────────────────────
const peso = v => v == null ? '—' : '₱' + Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const dash = v => v == null || v === '' ? '—' : v;

const ESCAPE_HTML_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, c => ESCAPE_HTML_MAP[c]);
}

// ── Row count helper ───────────────────────────────────────
function setRowCount(containerId, count, label = 'record') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.textContent = count === 0 ? 'No records' : `${count} ${label}${count !== 1 ? 's' : ''}`;
}

// ── Generic pagination helpers ──────────────────────────────
const PAGE_SIZE = 15;

function clampPage(total, page, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return Math.min(Math.max(1, page), totalPages);
}

function paginate(rows, page, pageSize = PAGE_SIZE) {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

function renderPager(containerId, total, page, fnName, pageSize = PAGE_SIZE) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  let items = '';
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
      items += `<li class="page-item ${i === page ? 'active' : ''}"><a class="page-link" href="#" onclick="event.preventDefault();${fnName}(${i})">${i}</a></li>`;
    } else if (i === 2 || i === totalPages - 1) {
      items += `<li class="page-item disabled"><span class="page-link">…</span></li>`;
    }
  }
  el.innerHTML = `<nav class="mt-2"><ul class="pagination pagination-sm justify-content-end mb-0 flex-wrap">
    <li class="page-item ${page <= 1 ? 'disabled' : ''}"><a class="page-link" href="#" onclick="event.preventDefault();${fnName}(${page - 1})">&laquo;</a></li>
    ${items}
    <li class="page-item ${page >= totalPages ? 'disabled' : ''}"><a class="page-link" href="#" onclick="event.preventDefault();${fnName}(${page + 1})">&raquo;</a></li>
  </ul></nav>`;
}

// ── Navigate ───────────────────────────────────────────────
function go(page) {
  if (!getToken() && page !== 'login') { renderLogin(); return; }
  if (getToken() && page === 'login')  { go('dashboard'); return; }
  currentPage = page;
  window.scrollTo({ top: 0, behavior: 'instant' });
  const map = { login: renderLogin, dashboard: renderDashboard, trips: renderTrips, employees: renderEmployees,
                buses: renderBuses, reports: renderReports, finance: renderFinance, users: renderUsers,
                backup: renderBackup, audit: renderAudit, help: renderHelp };
  (map[page] || (() => toast('Unknown page', 'warning')))();
}

// ── App shell ──────────────────────────────────────────────
function shell(activePage, content) {
  const user = getUser();
  const nav = [
    { id: 'dashboard', icon: 'fa-th-large',  label: 'Dashboard' },
    { id: 'trips',     icon: 'fa-route',     label: 'Trip Management' },
    { id: 'buses',     icon: 'fa-bus',       label: 'Buses' },
    { id: 'employees', icon: 'fa-users',     label: 'Employees' },
  ];
  if (isAdmin()) nav.push({ id: 'finance', icon: 'fa-money-bill-wave', label: 'Finance' });
  nav.push({ id: 'reports', icon: 'fa-chart-bar', label: 'Reports' });
  if (isAdmin()) {
    nav.push({ id: 'users',  icon: 'fa-user-cog',        label: 'Staff Accounts' });
    nav.push({ id: 'audit',  icon: 'fa-clipboard-list',  label: 'Audit Log' });
    nav.push({ id: 'backup', icon: 'fa-database',        label: 'Backup' });
  }
  nav.push({ id: 'help', icon: 'fa-circle-question', label: 'Help' });

  const navHtml = nav.map(n => `
    <div class="nav-link-item ${activePage === n.id ? 'active' : ''}"
      onclick="go('${n.id}')" title="${n.label}">
      <i class="fas ${n.icon}"></i> <span>${n.label}</span>
    </div>`).join('');

  document.getElementById('app').innerHTML = `
    <div class="sidebar-overlay" id="sidebarOverlay" onclick="closeSidebar()"></div>
    <div class="app-layout">
      <aside class="sidebar" id="appSidebar">
        <div class="sidebar-brand">
          <div class="brand-icon"><i class="fas fa-bus-alt"></i></div>
          <h6>METROLINK FOMS</h6>
          <small>Baclaran Bus Corp.</small>
        </div>
        <nav class="sidebar-nav">${navHtml}</nav>
        <div class="sidebar-footer">
          <div class="user-name">${user?.fullName || user?.username}</div>
          <div class="user-role">${user?.role}</div>
          <button class="logout-btn" onclick="logout()"><i class="fas fa-sign-out-alt me-1"></i>Logout</button>
        </div>
      </aside>
      <main class="main-content">
        <div class="topbar">
          <button class="topbar-toggle" onclick="toggleSidebar()" aria-label="Menu">
            <i class="fas fa-bars"></i>
          </button>
          <span class="topbar-title"><i class="fas fa-bus-alt me-1"></i>METROLINK FOMS</span>
          <span class="topbar-user">${user?.fullName || user?.username}</span>
        </div>
        ${content}
      </main>
    </div>`;
}

function toggleSidebar() {
  document.getElementById('appSidebar')?.classList.toggle('open');
  document.getElementById('sidebarOverlay')?.classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('appSidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
}

async function logout() {
  const ok = await confirmModal(
    'Log Out',
    'Are you sure you want to log out of Metrolink FOMS?',
    'Log Out',
    'btn-danger'
  );
  if (!ok) return;
  clearSession();
  renderLogin();
}

// ══════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════
function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div class="login-wrapper">
      <div class="login-split">

        <!-- Left panel — branded hero -->
        <div class="login-hero">
          <!-- Decorative pill shapes -->
          <div class="login-deco">
            <span class="deco-pill p1"></span>
            <span class="deco-pill p2"></span>
            <span class="deco-pill p3"></span>
            <span class="deco-pill p4"></span>
            <span class="deco-pill p5"></span>
            <span class="deco-pill p6"></span>
          </div>
          <div class="login-hero-content">
            <div class="hero-icon"><i class="fas fa-bus-alt"></i></div>
            <h2>Metrolink FOMS</h2>
            <p>Financial & Operational Management System for Baclaran Bus Corporation. Monitor trips, payroll, and revenue in real time.</p>
            <div class="hero-badges">
              <span><i class="fas fa-route me-1"></i>Trip Tracking</span>
              <span><i class="fas fa-coins me-1"></i>Finance</span>
              <span><i class="fas fa-users me-1"></i>HR</span>
            </div>
          </div>
        </div>

        <!-- Right panel — form -->
        <div class="login-form-panel">
          <div class="login-form-inner">
            <div class="login-form-header">
              <div class="lf-logo"><i class="fas fa-bus-alt"></i></div>
              <h5>USER LOGIN</h5>
              <p>Sign in to your account to continue</p>
            </div>
            <form onsubmit="doLogin(event)">
              <div class="mb-3">
                <label class="form-label">Username</label>
                <div class="input-group">
                  <span class="input-group-text"><i class="fas fa-user"></i></span>
                  <input type="text" id="loginUser" class="form-control" placeholder="Enter username" required autofocus>
                </div>
              </div>
              <div class="mb-4">
                <label class="form-label">Password</label>
                <div class="input-group">
                  <span class="input-group-text"><i class="fas fa-lock"></i></span>
                  <input type="password" id="loginPass" class="form-control" placeholder="Enter password" required>
                  <button type="button" class="btn btn-pass-toggle" onclick="toggleLoginPass(this)" tabindex="-1" title="Show/hide password">
                    <i class="fas fa-eye"></i>
                  </button>
                </div>
              </div>
              <button type="submit" class="btn btn-login-submit w-100" id="loginBtn">
                <i class="fas fa-sign-in-alt me-2"></i>LOGIN
              </button>
              <div id="loginError" class="alert alert-danger d-none mt-3 py-2 px-3" role="alert" style="font-size:0.85rem">
                <i class="fas fa-exclamation-circle me-2"></i><span id="loginErrorMsg"></span>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>`;
}

function toggleLoginPass(btn) {
  const input = document.getElementById('loginPass');
  const icon  = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fas fa-eye-slash';
    btn.title = 'Hide password';
  } else {
    input.type = 'password';
    icon.className = 'fas fa-eye';
    btn.title = 'Show password';
  }
}

let _loginFailCount = 0;
let _loginCooldownEnd = 0;
let _loginCooldownTimer = null;
const LOGIN_MAX_ATTEMPTS = 3;
const LOGIN_COOLDOWN_MS  = 30000; // 30 seconds

async function doLogin(e) {
  e.preventDefault();

  // Block if still in cooldown
  if (_loginCooldownEnd > Date.now()) {
    const secs = Math.ceil((_loginCooldownEnd - Date.now()) / 1000);
    _showLoginError(`Too many failed attempts. Please wait <strong>${secs}s</strong> before trying again.`, true);
    return;
  }

  const btn = document.getElementById('loginBtn');
  _showLoginError(null); // clear previous error
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging in…';

  try {
    const data = await api('/auth/login', 'POST', {
      username: document.getElementById('loginUser').value.trim(),
      password: document.getElementById('loginPass').value
    });
    _loginFailCount = 0; // reset on success
    saveSession(data);
    go('dashboard');
  } catch (err) {
    if ((err.message || '').toLowerCase().includes('deactivated')) {
      _showLoginError(`<i class="fas fa-ban me-1"></i>${err.message}`, true);
      toast(err.message, 'danger');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>LOGIN';
      return;
    }
    _loginFailCount++;
    if (_loginFailCount >= LOGIN_MAX_ATTEMPTS) {
      // Lock out
      _loginCooldownEnd = Date.now() + LOGIN_COOLDOWN_MS;
      _loginFailCount = 0;
      _startLoginCooldown();
    } else {
      const left = LOGIN_MAX_ATTEMPTS - _loginFailCount;
      const warn = left === 1
        ? `Incorrect username or password. <strong>1 attempt remaining</strong> before 30s lockout.`
        : `Incorrect username or password. <strong>${left} attempts remaining</strong> before lockout.`;
      _showLoginError(warn, true);
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>LOGIN';
    }
  }
}

function _showLoginError(msg, isHtml = false) {
  const errDiv = document.getElementById('loginError');
  const errMsg = document.getElementById('loginErrorMsg');
  if (!errDiv || !errMsg) return;
  if (!msg) { errDiv.classList.add('d-none'); return; }
  if (isHtml) errMsg.innerHTML = msg; else errMsg.textContent = msg;
  errDiv.classList.remove('d-none');
}

function _startLoginCooldown() {
  const tick = () => {
    const btn  = document.getElementById('loginBtn');
    const secs = Math.ceil((_loginCooldownEnd - Date.now()) / 1000);
    if (secs <= 0) {
      clearInterval(_loginCooldownTimer);
      _loginCooldownTimer = null;
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>LOGIN'; }
      _showLoginError('<i class="fas fa-check-circle me-1"></i>You may try again now.', true);
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-lock me-2"></i>Locked — try again in ${secs}s`;
    }
    _showLoginError(`Too many failed attempts. Account locked for <strong>${secs} second${secs !== 1 ? 's' : ''}</strong>.`, true);
  };
  tick();
  _loginCooldownTimer = setInterval(tick, 1000);
}

// ══════════════════════════════════════════════════════════
// TRIPS
// ══════════════════════════════════════════════════════════
let tripBuses = [], tripDrivers = [], tripConductors = [], tripsList = [];
let _tripPage = 1, _tripRows = [];

async function renderTrips() {
  shell('trips', `
    <div class="page-header">
      <div><h4><i class="fas fa-route me-2"></i>Trip Management</h4>
        <div class="subtitle">Record and manage daily bus trips</div></div>
      <button class="btn btn-primary btn-sm" onclick="openAddTrip()">
        <i class="fas fa-plus me-1"></i>Add Trip
      </button>
    </div>
    <div class="content-card mb-3">
      <div class="table-toolbar">
        <select id="tripDriverFilter" class="form-select form-select-sm" style="max-width:170px">
          <option value="">All Drivers</option>
        </select>
        <select id="tripConductorFilter" class="form-select form-select-sm" style="max-width:170px">
          <option value="">All Conductors</option>
        </select>
        <select id="tripBusFilter" class="form-select form-select-sm" style="max-width:120px">
          <option value="">All Buses</option>
        </select>
        <select id="tripStatusFilter" class="form-select form-select-sm" style="max-width:130px">
          <option value="">All Statuses</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="ONGOING">On Going</option>
          <option value="FINISHED">Finished</option>
        </select>
        <input type="date" id="tripDateFilter" class="form-control form-control-sm" style="max-width:150px">
        <button class="btn btn-primary btn-sm" onclick="sendTripFilter()">
          <i class="fas fa-arrow-right me-1"></i>Enter
        </button>
        <span class="row-count-badge ms-auto" id="tripCount"></span>
      </div>
      <div class="table-responsive">
        <table class="table table-hover mb-0" id="tripTable">
          <thead><tr>
            <th>Date</th><th>Bus</th><th>Driver</th><th>Conductor</th>
            <th>Dispatch</th><th>Arrival</th><th>Trips</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody id="tripBody">
            <tr><td colspan="9" class="table-empty"><div class="spinner-border spinner-border-sm text-muted"></div></td></tr>
          </tbody>
        </table>
      </div>
      <div id="tripPager"></div>
    </div>
    ${getTripModal()}${getIncomeExpModal()}${getArrivalModal()}`);

  try {
    [tripsList, tripBuses, tripDrivers, tripConductors] = await Promise.all([
      api('/trips'),
      api('/buses'),
      api('/employees'),
      api('/employees')
    ]);
    tripDrivers    = tripDrivers.filter(e => e.position === 'DRIVER' && e.isActive);
    tripConductors = tripConductors.filter(e => e.position === 'CONDUCTOR' && e.isActive);
    populateTripFilters();
    renderTripRows(tripsList);
  } catch { renderTripRows([]); }
}

function renderTripRows(rows, resetPage = true) {
  const tbody = document.getElementById('tripBody');
  if (!tbody) return;
  _tripRows = rows;
  if (resetPage) _tripPage = 1;
  setRowCount('tripCount', rows.length, 'trip');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="table-empty"><i class="fas fa-route"></i>No trips found</td></tr>`;
    document.getElementById('tripPager').innerHTML = '';
    return;
  }
  _tripPage = clampPage(rows.length, _tripPage);
  tbody.innerHTML = paginate(rows, _tripPage).map(t => `
    <tr>
      <td>${t.tripDate}</td>
      <td><strong>${dash(t.busNumber)}</strong></td>
      <td>${dash(t.driverName)}</td>
      <td>${dash(t.conductorName)}</td>
      <td>${t.dispatchTime || '—'}</td>
      <td>${t.arrivalTime ? t.arrivalTime + (t.arrivalDate && t.arrivalDate !== t.tripDate ? ' <span class="badge bg-secondary" title="Arrived on ' + t.arrivalDate + '">+1d</span>' : '') : '—'}</td>
      <td class="text-center">${t.tripCount != null ? t.tripCount : '—'}</td>
      <td>${statusBadge(t.status)}</td>
      <td style="white-space:nowrap">
        ${t.status === 'SCHEDULED' ? `<button class="btn btn-outline-warning btn-icon btn-sm me-1" onclick="startTrip(${t.id})" title="Start Trip"><i class="fas fa-play"></i></button>` : ''}
        <button class="btn btn-outline-primary btn-icon btn-sm me-1" onclick="openIncomeExp(${t.id},'${t.busNumber}','${t.tripDate}')" title="${t.status === 'FINISHED' ? 'Income & Expenses' : 'Finish trip first'}" ${t.status !== 'FINISHED' ? 'disabled' : ''}>
          <i class="fas fa-dollar-sign"></i>
        </button>
        ${t.status !== 'FINISHED' ? `<button class="btn btn-outline-success btn-icon btn-sm me-1" onclick="openArrivalModal(${t.id},'${t.arrivalTime||''}','${t.arrivalDate||''}','${t.tripDate}',${t.tripCount != null ? t.tripCount : 'null'})" title="Set Arrival Time">
          <i class="fas fa-clock"></i>
        </button>` : ''}
        ${isAdmin() ? `<button class="btn btn-outline-secondary btn-icon btn-sm" onclick="openEditTrip(${t.id})" title="Edit Trip"><i class="fas fa-edit"></i></button>` : ''}
      </td>
    </tr>`).join('');
  renderPager('tripPager', rows.length, _tripPage, 'changeTripPage');
}

function changeTripPage(p) {
  _tripPage = p;
  renderTripRows(_tripRows, false);
}

// ── Trip filter dropdowns & Send button ──────────────────────
function populateTripFilters() {
  const dSel = document.getElementById('tripDriverFilter');
  const cSel = document.getElementById('tripConductorFilter');
  const bSel = document.getElementById('tripBusFilter');
  if (dSel) dSel.innerHTML = '<option value="">All Drivers</option>' +
    tripDrivers.map(d => `<option value="${d.id}">${d.fullName}</option>`).join('');
  if (cSel) cSel.innerHTML = '<option value="">All Conductors</option>' +
    tripConductors.map(c => `<option value="${c.id}">${c.fullName}</option>`).join('');
  if (bSel) bSel.innerHTML = '<option value="">All Buses</option>' +
    tripBuses.map(b => `<option value="${b.busNumber}">${b.busNumber}</option>`).join('');
}

function sendTripFilter(resetPage = true) {
  const driverId    = document.getElementById('tripDriverFilter')?.value;
  const conductorId = document.getElementById('tripConductorFilter')?.value;
  const busNum      = document.getElementById('tripBusFilter')?.value;
  const dateVal     = document.getElementById('tripDateFilter')?.value;
  const statusVal   = document.getElementById('tripStatusFilter')?.value;

  let filtered = tripsList;

  if (busNum) {
    filtered = filtered.filter(t => t.busNumber === busNum);
  }
  if (dateVal) {
    filtered = filtered.filter(t => t.tripDate === dateVal);
  }
  if (driverId) {
    const driver = tripDrivers.find(d => d.id == driverId);
    if (driver) filtered = filtered.filter(t => t.driverName === driver.fullName);
  }
  if (conductorId) {
    const conductor = tripConductors.find(c => c.id == conductorId);
    if (conductor) filtered = filtered.filter(t => t.conductorName === conductor.fullName);
  }
  if (statusVal) {
    filtered = filtered.filter(t => t.status === statusVal);
  }

  renderTripRows(filtered, resetPage);
}

async function refreshTripTable() {
  tripsList = await api('/trips');
  sendTripFilter(false);
}

function statusBadge(s) {
  if (s === 'SCHEDULED') return '<span class="status-badge status-scheduled">Scheduled</span>';
  if (s === 'ONGOING')   return '<span class="status-badge status-ongoing">On Going</span>';
  if (s === 'FINISHED')  return '<span class="status-badge status-finished">Finished</span>';
  return '<span class="status-badge status-active">' + (s || 'Unknown') + '</span>';
}

async function startTrip(id) {
  if (!await confirmModal('Start Trip', 'Start this trip now? The status will change to On Going.', 'Start Trip', 'btn-warning')) return;
  try {
    await api('/trips/' + id + '/start', 'POST');
    toast('Trip started!');
    await refreshTripTable();
  } catch (e) {
    toast('Failed to start trip: ' + (e.message || e), 'danger');
  }
}

function getTripModal() {
  return `
  <div class="modal fade" id="tripModal" tabindex="-1">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="tripModalTitle"><i class="fas fa-route me-2"></i>Add Trip</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div id="tripTab0">
            <input type="hidden" id="tripId">
            <div class="row g-3">
              <div class="col-md-4">
                <label class="form-label">Trip Date *</label>
                <input type="date" id="tDate" class="form-control" required oninput="refreshAvailableStaff()">
              </div>
              <div class="col-md-4">
                <label class="form-label">Bus *</label>
                <select id="tBus" class="form-select" required></select>
              </div>
              <div class="col-md-4">
                <label class="form-label">Trip Count</label>
                <select id="tCount" class="form-select">
                  <option value="" selected>— (not set) —</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                  <option value="6">6</option>
                  <option value="7">7</option>
                  <option value="8">8</option>
                  <option value="9">9</option>
                  <option value="10">10</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label">Driver *</label>
                <select id="tDriver" class="form-select" required></select>
              </div>
              <div class="col-md-6">
                <label class="form-label">Conductor *</label>
                <select id="tConductor" class="form-select" required></select>
              </div>
              <div class="col-md-4">
                <label class="form-label">Dispatch Time *</label>
                <input type="time" id="tDispatch" class="form-control" required>
              </div>
              <div class="col-md-4">
                <label class="form-label">Arrival Time</label>
                <input type="time" id="tArrival" class="form-control">
              </div>
              <div class="col-md-4">
                <label class="form-label">Arrival Date</label>
                <input type="date" id="tArrivalDate" class="form-control">
              </div>
              <div class="col-12">
                <label class="form-label">Remarks</label>
                <textarea id="tRemarks" class="form-control" rows="2" placeholder="Optional remarks…"></textarea>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
          <button class="btn btn-success btn-sm" id="tripSaveBtn" onclick="saveTripOnly()">
            <i class="fas fa-save me-1"></i>Save Trip
          </button>
        </div>
      </div>
    </div>
  </div>`;
}

// Trip modal tab management
let tripTabIdx = 0;
let savedTripId = null;
let tripModalMode = 'add';

function openAddTrip() {
  tripTabIdx = 0; savedTripId = null; tripModalMode = 'add';
  document.getElementById('tripModalTitle').innerHTML = '<i class="fas fa-plus me-2"></i>Add Trip';
  document.getElementById('tripId').value = '';
  ['tDate','tDispatch','tArrival','tArrivalDate','tRemarks','tCount'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('tDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('tArrivalDate').value = new Date().toISOString().split('T')[0];
  populateTripDropdowns();
  refreshAvailableStaff();
  new bootstrap.Modal(document.getElementById('tripModal')).show();
}

async function openEditTrip(id) {
  tripTabIdx = 0; savedTripId = id; tripModalMode = 'edit';
  document.getElementById('tripModalTitle').innerHTML = '<i class="fas fa-edit me-2"></i>Edit Trip';
  const trip = await api(`/trips/${id}`);
  document.getElementById('tripId').value = id;
  document.getElementById('tDate').value = trip.tripDate;
  document.getElementById('tCount').value = trip.tripCount != null ? trip.tripCount : '';
  document.getElementById('tDispatch').value = (trip.dispatchTime || '').substring(0, 5);
  document.getElementById('tArrival').value  = (trip.arrivalTime  || '').substring(0, 5);
  document.getElementById('tArrivalDate').value = trip.arrivalDate || '';
  document.getElementById('tRemarks').value = trip.remarks || '';
  populateTripDropdowns(trip.busId, trip.driverId, trip.conductorId);
  await refreshAvailableStaff();
  document.getElementById('tBus').value       = trip.busId;
  document.getElementById('tDriver').value    = trip.driverId;
  document.getElementById('tConductor').value = trip.conductorId;
  new bootstrap.Modal(document.getElementById('tripModal')).show();
}

function populateTripDropdowns(busId, driverId, conductorId) {
  const activeBuses = tripBuses.filter(b => b.status === 'ACTIVE' || b.id == busId);
  document.getElementById('tBus').innerHTML =
    activeBuses.map(b => `<option value="${b.id}" ${b.id == busId ? 'selected' : ''}>${b.busNumber} — ${b.plateNo}</option>`).join('');
  document.getElementById('tDriver').innerHTML =
    tripDrivers.map(d => `<option value="${d.id}" ${d.id == driverId ? 'selected' : ''}>${d.fullName}</option>`).join('');
  document.getElementById('tConductor').innerHTML =
    tripConductors.map(c => `<option value="${c.id}" ${c.id == conductorId ? 'selected' : ''}>${c.fullName}</option>`).join('');
  updateDamageEmployeeOpts();
}

function updateDamageEmployeeOpts() {
  const driverId    = document.getElementById('tDriver')?.value;
  const conductorId = document.getElementById('tConductor')?.value;
  const driver    = tripDrivers.find(d => d.id == driverId);
  const conductor = tripConductors.find(c => c.id == conductorId);
  const opts = [driver, conductor].filter(Boolean);
  const empSel = document.getElementById('eEmployeeId');
  if (!empSel) return;
  const curVal = empSel.value;
  empSel.innerHTML = '<option value="">— None —</option>' +
    opts.map(e => `<option value="${e.id}" ${e.id == curVal ? 'selected' : ''}>${e.fullName} (${e.position})</option>`).join('');
}

async function refreshAvailableStaff() {
  const date = document.getElementById('tDate')?.value;
  if (!date) return;
  const excludeId = savedTripId || 0;
  try {
    const { drivers, conductors, buses } = await api(`/trips/available-staff?date=${date}&excludeTripId=${excludeId}`);
    const curDriver    = document.getElementById('tDriver').value;
    const curConductor = document.getElementById('tConductor').value;
    const curBus       = document.getElementById('tBus').value;
    document.getElementById('tDriver').innerHTML =
      drivers.length
        ? drivers.map(d => `<option value="${d.id}" ${d.id == curDriver ? 'selected' : ''}>${d.fullName}</option>`).join('')
        : '<option value="" disabled>No drivers available for this date</option>';
    document.getElementById('tConductor').innerHTML =
      conductors.length
        ? conductors.map(c => `<option value="${c.id}" ${c.id == curConductor ? 'selected' : ''}>${c.fullName}</option>`).join('')
        : '<option value="" disabled>No conductors available for this date</option>';
    document.getElementById('tBus').innerHTML =
      buses.length
        ? buses.map(b => `<option value="${b.id}" ${b.id == curBus ? 'selected' : ''}>${b.busNumber} — ${b.plateNo}</option>`).join('')
        : '<option value="" disabled>No buses available for this date</option>';
  } catch {}
}

async function saveTripDetails() {
  const tCountEl = document.getElementById('tCount');
  const tArrivalEl = document.getElementById('tArrival');
  const tArrivalDateEl = document.getElementById('tArrivalDate');
  const body = {
    tripDate:     document.getElementById('tDate').value,
    busId:        +document.getElementById('tBus').value,
    driverId:     +document.getElementById('tDriver').value,
    conductorId:  +document.getElementById('tConductor').value,
    dispatchTime: document.getElementById('tDispatch').value + ':00',
    arrivalTime:  tArrivalEl.value ? tArrivalEl.value + ':00' : null,
    arrivalDate:  tArrivalDateEl.value || null,
    tripCount:    tCountEl.value ? +tCountEl.value : null,
    remarks:      document.getElementById('tRemarks').value
  };

  if (!body.tripDate || !body.busId || !body.driverId || !body.conductorId || !body.dispatchTime) {
    toast('Please fill all required fields', 'warning'); return false;
  }
  if ((body.arrivalTime && !body.arrivalDate) || (!body.arrivalTime && body.arrivalDate)) {
    toast('Arrival time and arrival date must both be set together', 'warning'); return false;
  }

  if (tripModalMode === 'edit' && savedTripId) {
    const ok = await confirmModal('Update Trip', 'Save changes to this trip?', 'Save Changes', 'btn-primary');
    if (!ok) return false;
  }

  try {
    if (tripModalMode === 'add' && !savedTripId) {
      const trip = await api('/trips', 'POST', body);
      savedTripId = trip.id;
      toast('Trip created');
    } else if (tripModalMode === 'edit' && savedTripId) {
      await api(`/trips/${savedTripId}`, 'PUT', body);
      toast('Trip updated');
    }
    return true;
  } catch { return false; }
}

async function saveTripOnly() {
  const btn = document.getElementById('tripSaveBtn');
  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Saving...';
    }
    const ok = await saveTripDetails();
    if (!ok) return;
    bootstrap.Modal.getInstance(document.getElementById('tripModal')).hide();
    await refreshTripTable();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save me-1"></i>Save Trip';
    }
  }
}

// Income/Expenses view modal
function getIncomeExpModal() {
  return `
  <div class="modal fade" id="ieModal" tabindex="-1">
    <div class="modal-dialog modal-lg modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="ieTitle"><i class="fas fa-dollar-sign me-2"></i>Income & Expenses</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body" id="ieBody">
          <div class="text-center py-4"><div class="spinner-border text-primary"></div></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Close</button>
          <button class="btn btn-primary btn-sm" id="ieSaveBtn" onclick="saveIncomeExp()">
            <i class="fas fa-save me-1"></i>Save Changes
          </button>
        </div>
      </div>
    </div>
  </div>`;
}

let ieCurrentTripId = null;

async function openIncomeExp(tripId, busNum, tripDate) {
  ieCurrentTripId = tripId;
  document.getElementById('ieTitle').innerHTML = `<i class="fas fa-dollar-sign me-2"></i>Income & Expenses — Bus ${busNum} (${tripDate})`;
  const modal = new bootstrap.Modal(document.getElementById('ieModal'));
  modal.show();
  document.getElementById('ieBody').innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';

  const [inc, exp, trip] = await Promise.all([
    api(`/trips/${tripId}/income`).catch(() => null),
    api(`/trips/${tripId}/expenses`).catch(() => null),
    api(`/trips/${tripId}`).catch(() => null)
  ]);
  window._ieDriverId    = trip?.driverId    ?? null;
  window._ieConductorId = trip?.conductorId ?? null;

  const v = (obj, key, def = 0) => obj?.[key] ?? def;

  // Build damage employee dropdown — only driver and conductor assigned to this trip
  const assignedDriver    = (tripDrivers||[]).find(d => d.id === trip?.driverId);
  const assignedConductor = (tripConductors||[]).find(c => c.id === trip?.conductorId);
  const assignedEmps      = [assignedDriver, assignedConductor].filter(Boolean);
  const empOpts = '<option value="">— None —</option>' +
    assignedEmps.map(e => `<option value="${e.id}" ${e.id == v(exp,'employeeId') ? 'selected' : ''}>${e.fullName} (${e.position})</option>`).join('');

  document.getElementById('ieBody').innerHTML = `
    <div class="row g-3">
      <div class="col-md-6">
        <div class="section-header"><i class="fas fa-arrow-down me-1"></i>Income</div>
        <div class="mb-2"><label class="form-label">Gross Income</label>
          <div class="input-group"><span class="input-group-text">₱</span>
          <input type="number" id="ie_gross" class="form-control" value="${v(inc,'grossIncome')}" min="0" step="0.01" oninput="ieCalcNet();ieCalcBonus()"></div></div>
        <div class="mb-2"><label class="form-label">Additional Commission</label>
          <div class="input-group"><span class="input-group-text">₱</span>
          <input type="number" id="ie_addcomm" class="form-control bg-light" readonly title="₱100 each per ₱1,000 above ₱13,000 gross" value="0"></div>
          <div id="ie_addcommPreview" class="small text-muted mt-1"></div></div>
        <div class="mb-2"><label class="form-label">Bonus Each</label>
          <div class="input-group"><span class="input-group-text">₱</span>
          <input type="number" id="ie_bonuseach" class="form-control bg-light" readonly title="₱500 each if gross ≥ ₱23,000" value="0"></div>
          <div id="ie_bonuseachPreview" class="small text-muted mt-1"></div></div>
        <div class="mb-2"><label class="form-label">Driver Income</label>
          <div class="input-group"><span class="input-group-text">₱</span>
          <input type="number" id="ie_dinc" class="form-control bg-light" readonly title="Daily rate + additional commission + bonus each"></div></div>
        <div class="mb-2"><label class="form-label">Conductor Income</label>
          <div class="input-group"><span class="input-group-text">₱</span>
          <input type="number" id="ie_cinc" class="form-control bg-light" readonly title="Daily rate + additional commission + bonus each"></div></div>
        <div class="mb-2"><label class="form-label">Driver Bond</label>
          <div class="input-group"><span class="input-group-text">₱</span>
          <input type="number" id="ie_dbond" class="form-control" value="${v(inc,'driverBond')}" min="0" step="0.01" oninput="ieCalcNet()"></div></div>
        <div class="mb-2"><label class="form-label">Conductor Bond</label>
          <div class="input-group"><span class="input-group-text">₱</span>
          <input type="number" id="ie_cbond" class="form-control" value="${v(inc,'conductorBond')}" min="0" step="0.01" oninput="ieCalcNet()"></div></div>
        <div class="net-display mt-3">
          <div class="net-label">Net Income</div>
          <div class="net-value" id="ie_net">${peso(v(inc,'netIncome'))}</div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="section-header"><i class="fas fa-arrow-up me-1"></i>Expenses</div>
        ${[['ie_diesel','Diesel',v(exp,'diesel')],['ie_wash','Washing',v(exp,'washing')],
           ['ie_ot','Overtime',v(exp,'overtime')],
           ['ie_nd','Night Diff',v(exp,'nightDiff')],
           ['ie_ca','Cash Advance',v(exp,'cashAdvance')],['ie_dmg','Damages',v(exp,'damages')],
           ['ie_other','Other',v(exp,'otherExpenses')]].map(([id,lbl,val,extra]) => `
          <div class="mb-1 row g-1 align-items-center">
            <div class="col-4"><label class="form-label mb-0" style="font-size:0.78rem">${lbl}</label></div>
            <div class="col-8"><div class="input-group input-group-sm">
              <span class="input-group-text">₱</span>
              <input type="number" id="${id}" class="form-control${extra ? ' '+extra : ''}" value="${val}" min="0" step="0.01" ${extra?.includes('readonly') ? 'readonly' : 'oninput="ieCalcTotal()"'}>
            </div></div>
          </div>`).join('')}
        <div class="mb-1 row g-1 align-items-center">
          <div class="col-4"><label class="form-label mb-0" style="font-size:0.78rem">Damage Remark</label></div>
          <div class="col-8"><input type="text" id="ie_dremark" class="form-control form-control-sm" value="${v(exp,'damageRemark')||''}"></div>
        </div>
        <div class="mb-1 row g-1 align-items-center">
          <div class="col-4"><label class="form-label mb-0" style="font-size:0.78rem">Employee Responsible</label></div>
          <div class="col-8"><select id="ie_empid" class="form-select form-select-sm">${empOpts}</select></div>
        </div>
        <div class="net-display mt-2" style="background:#fff3e0;border-left-color:#ef6c00">
          <div class="net-label" style="color:#bf360c">Total Expenses</div>
          <div class="net-value" style="color:#e65100" id="ie_total">${peso(v(exp,'totalExpenses'))}</div>
        </div>
      </div>
    </div>`;
  // Auto-calculate additional commission and bonus each on load
  setTimeout(ieCalcBonus, 0);
}

function ieCalcNet() {
  const g  = +document.getElementById('ie_gross').value || 0;
  const db = +document.getElementById('ie_dbond').value || 0;
  const cb = +document.getElementById('ie_cbond').value || 0;
  document.getElementById('ie_net').textContent = peso(g - db - cb);
}

function ieCalcBonus() {
  const gross = +document.getElementById('ie_gross').value || 0;

  // Additional Commission: ₱100 each per ₱1,000 above ₱13,000
  const units   = Math.max(0, Math.floor((gross - 13000) / 1000));
  const addComm = units * 100;
  const acEl = document.getElementById('ie_addcomm');
  if (acEl) acEl.value = addComm;
  const acPrev = document.getElementById('ie_addcommPreview');
  if (acPrev) acPrev.innerHTML = units > 0
    ? `<i class="fas fa-plus-circle text-success me-1"></i><strong class="text-success">+₱${addComm} each</strong> (${units} unit${units > 1 ? 's' : ''} × ₱100 above ₱13,000)`
    : `<i class="fas fa-info-circle me-1"></i>No additional commission — below ₱13,000`;

  // Bonus Each: ₱500 each if gross ≥ ₱23,000
  const bonusEach = gross >= 23000 ? 500 : 0;
  const beEl = document.getElementById('ie_bonuseach');
  if (beEl) beEl.value = bonusEach;
  const bePrev = document.getElementById('ie_bonuseachPreview');
  if (bePrev) bePrev.innerHTML = bonusEach > 0
    ? `<i class="fas fa-star text-warning me-1"></i><strong class="text-success">+₱500 each</strong> — reached ₱23,000 target`
    : `<i class="fas fa-info-circle me-1"></i>No bonus — below ₱23,000`;

  // Auto-update driver and conductor income: daily rate + additional commission + bonus each
  const driver    = (tripDrivers    || []).find(d => d.id === window._ieDriverId);
  const conductor = (tripConductors || []).find(c => c.id === window._ieConductorId);
  const total = addComm + bonusEach;
  const dRateEl = document.getElementById('ie_dinc');
  const cRateEl = document.getElementById('ie_cinc');
  if (dRateEl) dRateEl.value = (driver?.dailyRate    ?? 1225) + total;
  if (cRateEl) cRateEl.value = (conductor?.dailyRate ?? 1225) + total;
  ieCalcTotal();
}

function ieCalcTotal() {
  const ids = ['ie_diesel','ie_wash','ie_ot','ie_nd','ie_ca','ie_dmg','ie_other'];
  const t = ids.reduce((s,id) => s + (+document.getElementById(id).value||0), 0);
  document.getElementById('ie_total').textContent = peso(t);
}

async function saveIncomeExp() {
  const btn = document.getElementById('ieSaveBtn');
  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Saving...';
    }
    await api(`/trips/${ieCurrentTripId}/income`, 'POST', {
      grossIncome:     +document.getElementById('ie_gross').value||0,
      driverIncome:    +document.getElementById('ie_dinc').value||0,
      conductorIncome: +document.getElementById('ie_cinc').value||0,
      driverBond:      +document.getElementById('ie_dbond').value||0,
      conductorBond:   +document.getElementById('ie_cbond').value||0,
      commission:      0
    });
    const empIdVal = document.getElementById('ie_empid').value;
    await api(`/trips/${ieCurrentTripId}/expenses`, 'POST', {
      diesel:        +document.getElementById('ie_diesel').value||0,
      washing:       +document.getElementById('ie_wash').value||0,
      driverSalary:  0,
      overtime:      +document.getElementById('ie_ot').value||0,
      nightDiff:     +document.getElementById('ie_nd').value||0,
      bonus:         0,
      cashAdvance:   +document.getElementById('ie_ca').value||0,
      damages:       +document.getElementById('ie_dmg').value||0,
      damageRemark:  document.getElementById('ie_dremark').value||null,
      employeeId:    empIdVal ? +empIdVal : null,
      otherExpenses: +document.getElementById('ie_other').value||0
    });
    await refreshTripTable();
    toast('Income & Expenses saved!');
    bootstrap.Modal.getInstance(document.getElementById('ieModal')).hide();
  } catch {
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save me-1"></i>Save Changes';
    }
  }
}

// ══════════════════════════════════════════════════════════
// Arrival Time Modal
function getArrivalModal() {
  return `
  <div class="modal fade" id="arrivalModal" tabindex="-1">
    <div class="modal-dialog modal-sm">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"><i class="fas fa-clock me-2"></i>Set Arrival Time</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="arrivalTripId">
          <input type="hidden" id="arrivalTripDate">
          <label class="form-label fw-semibold">Arrival Time *</label>
          <input type="time" id="arrivalTimeInput" class="form-control mb-2" oninput="suggestArrivalDate()">
          <label class="form-label fw-semibold">Arrival Date *</label>
          <input type="date" id="arrivalDateInput" class="form-control mb-2" required>
          <label class="form-label fw-semibold">Trip Count *</label>
          <select id="arrivalTripCount" class="form-select" required>
            <option value="">Select trip count...</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
            <option value="7">7</option>
            <option value="8">8</option>
            <option value="9">9</option>
            <option value="10">10</option>
          </select>
          <div class="form-text text-muted">Date defaults to the trip date — change it for overnight trips.</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
          <button class="btn btn-primary btn-sm" id="arrivalSaveBtn" onclick="saveArrivalTime()">
            <i class="fas fa-save me-1"></i>Save
          </button>
        </div>
      </div>
    </div>
  </div>`;
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().split('T')[0];
}

function suggestArrivalDate() {
  const time = document.getElementById('arrivalTimeInput').value;
  const tripDate = document.getElementById('arrivalTripDate').value;
  document.getElementById('arrivalDateInput').value = time ? tripDate : '';
}

function openArrivalModal(tripId, currentArrival, currentArrivalDate, tripDate, currentTripCount) {
  document.getElementById('arrivalTripId').value = tripId;
  document.getElementById('arrivalTripDate').value = tripDate;
  document.getElementById('arrivalTimeInput').value = currentArrival ? currentArrival.substring(0, 5) : '';
  document.getElementById('arrivalDateInput').value = currentArrivalDate ||
    (currentArrival ? tripDate : '');
  document.getElementById('arrivalTripCount').value = currentTripCount != null ? currentTripCount : '';
  new bootstrap.Modal(document.getElementById('arrivalModal')).show();
}

async function saveArrivalTime() {
  const btn = document.getElementById('arrivalSaveBtn');
  const tripId = document.getElementById('arrivalTripId').value;
  const timeVal = document.getElementById('arrivalTimeInput').value;
  const dateVal = document.getElementById('arrivalDateInput').value;
  const tripCountVal = document.getElementById('arrivalTripCount').value;
  if (!timeVal) { toast('Arrival time is required', 'warning'); return; }
  if (!dateVal) { toast('Arrival date is required', 'warning'); return; }
  if (!tripCountVal) { toast('Trip count is required', 'warning'); return; }
  try {
    btn.disabled = true;
    await api(`/trips/${tripId}`, 'PATCH', {
      arrivalTime: timeVal + ':00',
      arrivalDate: dateVal || null,
      tripCount: +tripCountVal
    });
    bootstrap.Modal.getInstance(document.getElementById('arrivalModal')).hide();
    await refreshTripTable();
    toast('Trip finished!');
  } catch (e) {
    toast('Failed to save: ' + (e.message || e), 'danger');
  } finally {
    btn.disabled = false;
  }
}

// EMPLOYEES
// ══════════════════════════════════════════════════════════
async function renderEmployees() {
  shell('employees', `
    <div class="page-header">
      <div><h4><i class="fas fa-users me-2"></i>Employees</h4>
        <div class="subtitle">Manage drivers and conductors</div></div>
      ${isAdmin() ? `<button class="btn btn-primary btn-sm" onclick="openAddEmployee()"><i class="fas fa-plus me-1"></i>Add Employee</button>` : ''}
    </div>
    <div class="content-card">
      <div class="table-toolbar">
        <input type="text" id="empSearch" class="form-control form-control-sm" style="max-width:220px"
          placeholder="Search name…" oninput="filterEmployeeRows(this.value)">
        <select id="empPosFilter" class="form-select form-select-sm" style="max-width:140px" onchange="filterEmployeeRows()">
          <option value="">All Positions</option>
          <option value="DRIVER">Driver</option>
          <option value="CONDUCTOR">Conductor</option>
          <option value="HR">HR</option>
          <option value="OPERATIONS">Operations</option>
          <option value="MECHANIC">Mechanic</option>
        </select>
        <select id="empLicenseFilter" class="form-select form-select-sm" style="max-width:155px" onchange="filterEmployeeRows()">
          <option value="">All Licenses</option>
          <option value="valid">License Valid</option>
          <option value="expiring">License Expiring Soon</option>
          <option value="expired">License Expired</option>
          <option value="none">No License Required</option>
        </select>
        <span class="row-count-badge ms-auto" id="empCount"></span>
      </div>
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead><tr><th>Code</th><th>Name</th><th>Birthdate</th><th>Address</th><th>Position</th><th>License Expiry</th><th>Daily Rate</th><th>Bi-Monthly Rate</th><th>Status</th>
            ${isAdmin() ? '<th>Actions</th>' : ''}</tr></thead>
          <tbody id="empBody"><tr><td colspan="6" class="table-empty">
            <div class="spinner-border spinner-border-sm text-muted"></div></td></tr></tbody>
        </table>
      </div>
      <div id="empPager"></div>
    </div>
    ${getEmployeeModal()}`);

  try {
    const emps = await api('/employees');
    window._emps = emps;
    renderEmployeeRows(emps);
  } catch { renderEmployeeRows([]); }
}

let _empPage = 1;

function renderEmployeeRows(rows, resetPage = true) {
  const tbody = document.getElementById('empBody');
  if (!tbody) return;
  if (resetPage) _empPage = 1;
  setRowCount('empCount', rows.length, 'employee');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="table-empty"><i class="fas fa-users"></i>No employees found</td></tr>`;
    document.getElementById('empPager').innerHTML = '';
    return;
  }
  _empPage = clampPage(rows.length, _empPage);
  tbody.innerHTML = paginate(rows, _empPage).map(e => `
    <tr>
      <td><code>${e.employeeCode}</code></td>
      <td><strong>${e.fullName}</strong></td>
      <td>${e.birthdate || '—'}</td>
      <td>${dash(e.address)}</td>
      <td><span class="status-badge ${{DRIVER:'status-driver',CONDUCTOR:'status-conductor',HR:'status-hr',OPERATIONS:'status-operations',MECHANIC:'status-mechanic'}[e.position]||'status-inactive'}">${e.position}</span></td>
      <td>${expiryCell(e.licenseExpiry)}</td>
      <td>${e.dailyRate != null ? peso(e.dailyRate) : '—'}</td>
      <td>${e.biMonthlyRate != null ? peso(e.biMonthlyRate) : '—'}</td>
      <td><span class="status-badge ${e.isActive ? 'status-active' : 'status-inactive'}">${e.isActive ? 'Active' : 'Inactive'}</span></td>
      ${isAdmin() ? `<td>
        <button class="btn btn-outline-primary btn-icon me-1" onclick="openEditEmployee(${e.id})" title="Edit"><i class="fas fa-edit"></i></button>
        <button class="btn ${e.isActive ? 'btn-outline-danger' : 'btn-outline-success'} btn-icon"
          onclick="toggleEmployee(${e.id},${!e.isActive})" title="${e.isActive ? 'Deactivate' : 'Activate'}">
          <i class="fas ${e.isActive ? 'fa-ban' : 'fa-check'}"></i>
        </button>
      </td>` : ''}
    </tr>`).join('');
  renderPager('empPager', rows.length, _empPage, 'changeEmpPage');
}

function changeEmpPage(p) {
  _empPage = p;
  filterEmployeeRows(undefined, false);
}

function filterEmployeeRows(q, resetPage = true) {
  const search   = (q ?? document.getElementById('empSearch')?.value ?? '').toLowerCase();
  const pos      = document.getElementById('empPosFilter')?.value || '';
  const lic      = document.getElementById('empLicenseFilter')?.value || '';
  const today    = new Date().toISOString().split('T')[0];
  const in30     = addDays(today, 30);
  const rows     = (window._emps || []).filter(e => {
    if (search && !e.fullName.toLowerCase().includes(search) && !e.employeeCode.toLowerCase().includes(search)) return false;
    if (pos && e.position !== pos) return false;
    if (lic) {
      const isOperator = ['DRIVER','CONDUCTOR'].includes(e.position);
      if (lic === 'none') return !isOperator;
      if (!isOperator || !e.licenseExpiry) return false;
      if (lic === 'expired') return e.licenseExpiry < today;
      if (lic === 'expiring') return e.licenseExpiry >= today && e.licenseExpiry <= in30;
      if (lic === 'valid') return e.licenseExpiry > in30;
    }
    return true;
  });
  renderEmployeeRows(rows, resetPage);
}

function getEmployeeModal() {
  return `
  <div class="modal fade" id="empModal" tabindex="-1">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="empModalTitle">Add Employee</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="empId">
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label">Employee Code *</label>
              <input type="text" id="empCode" class="form-control" placeholder="e.g. D001">
            </div>
            <div class="col-md-6">
              <label class="form-label">Position *</label>
              <select id="empPos" class="form-select" onchange="onEmpPosChange()">
                <option value="DRIVER">Driver</option>
                <option value="CONDUCTOR">Conductor</option>
                <option value="HR">HR</option>
                <option value="OPERATIONS">Operations</option>
                <option value="MECHANIC">Mechanic</option>
              </select>
            </div>
            <div class="col-12">
              <label class="form-label">Full Name *</label>
              <input type="text" id="empName" class="form-control" placeholder="Last Name, First Name">
            </div>
            <div class="col-md-6">
              <label class="form-label">Birthdate</label>
              <input type="date" id="empBirthdate" class="form-control">
            </div>
            <div class="col-md-6">
              <label class="form-label" id="empRateLabel">Daily Rate (₱)</label>
              <input type="number" id="empRate" class="form-control" value="1225" min="0" step="0.01">
              <div class="form-text text-muted" id="empRateHint"></div>
            </div>
            <div class="col-12">
              <label class="form-label">Address</label>
              <input type="text" id="empAddress" class="form-control" placeholder="Street, City">
            </div>
            <div class="col-12" id="empLicenseSection" style="display:none">
              <hr class="my-1"><div class="text-muted small fw-bold">License Documents</div>
            </div>
            <div class="col-md-6" id="empLicenseNoWrap" style="display:none">
              <label class="form-label">License No.</label>
              <input type="text" id="empLicenseNo" class="form-control" placeholder="e.g. D12-88-123456">
            </div>
            <div class="col-md-6" id="empLicenseExpiryWrap" style="display:none">
              <label class="form-label">License Expiry</label>
              <input type="date" id="empLicenseExpiry" class="form-control">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
          <button class="btn btn-primary btn-sm" onclick="saveEmployee()"><i class="fas fa-save me-1"></i>Save</button>
        </div>
      </div>
    </div>
  </div>`;
}

function onEmpPosChange() {
  const pos = document.getElementById('empPos').value;
  const isDaily = ['DRIVER','CONDUCTOR'].includes(pos);
  document.getElementById('empRateLabel').textContent = isDaily ? 'Daily Rate (₱)' : 'Bi-Monthly Rate (₱)';
  document.getElementById('empRateHint').textContent  = isDaily ? '' : 'Paid twice a month';
  if (!document.getElementById('empId').value) {
    document.getElementById('empRate').value = isDaily ? '1225' : '';
  }
  const showLicense = ['DRIVER','CONDUCTOR'].includes(pos);
  ['empLicenseSection','empLicenseNoWrap','empLicenseExpiryWrap'].forEach(
    id => document.getElementById(id).style.display = showLicense ? '' : 'none');
}

function openAddEmployee() {
  document.getElementById('empModalTitle').textContent = 'Add Employee';
  document.getElementById('empId').value = '';
  ['empCode','empName','empBirthdate','empAddress','empLicenseNo','empLicenseExpiry'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('empPos').value = 'DRIVER';
  document.getElementById('empRate').value = '1225';
  onEmpPosChange();
  new bootstrap.Modal(document.getElementById('empModal')).show();
}

async function openEditEmployee(id) {
  const emp = (window._emps || []).find(e => e.id === id);
  if (!emp) return;
  document.getElementById('empModalTitle').textContent = 'Edit Employee';
  document.getElementById('empId').value = id;
  document.getElementById('empCode').value = emp.employeeCode;
  document.getElementById('empName').value = emp.fullName;
  document.getElementById('empBirthdate').value = emp.birthdate || '';
  document.getElementById('empAddress').value = emp.address || '';
  document.getElementById('empPos').value = emp.position;
  document.getElementById('empLicenseNo').value = emp.licenseNo || '';
  document.getElementById('empLicenseExpiry').value = emp.licenseExpiry || '';
  const isDaily = ['DRIVER','CONDUCTOR'].includes(emp.position);
  document.getElementById('empRate').value = isDaily ? (emp.dailyRate ?? '') : (emp.biMonthlyRate ?? '');
  onEmpPosChange();
  new bootstrap.Modal(document.getElementById('empModal')).show();
}

async function saveEmployee() {
  const id  = document.getElementById('empId').value;
  const pos = document.getElementById('empPos').value;
  const isDaily = ['DRIVER','CONDUCTOR'].includes(pos);
  const rateVal = +document.getElementById('empRate').value;
  const body = {
    employeeCode:  document.getElementById('empCode').value.trim(),
    fullName:      document.getElementById('empName').value.trim(),
    birthdate:     document.getElementById('empBirthdate').value || null,
    address:       document.getElementById('empAddress').value.trim() || null,
    position:      pos,
    dailyRate:     isDaily ? rateVal : null,
    biMonthlyRate: isDaily ? null : rateVal,
    licenseNo:     document.getElementById('empLicenseNo').value.trim() || null,
    licenseExpiry: document.getElementById('empLicenseExpiry').value || null
  };
  if (!body.fullName) { toast('Full name is required', 'warning'); return; }
  if (id) {
    const ok = await confirmModal('Update Employee', 'Save changes to this employee record?', 'Save Changes', 'btn-primary');
    if (!ok) return;
  }
  try {
    if (id) { await api(`/employees/${id}`, 'PUT', body); toast('Employee updated'); }
    else    { await api('/employees', 'POST', body); toast('Employee added'); }
    bootstrap.Modal.getInstance(document.getElementById('empModal')).hide();
    renderEmployees();
  } catch {}
}

async function toggleEmployee(id, active) {
  const ok = await confirmModal(
    `${active ? 'Activate' : 'Deactivate'} Employee`,
    `Are you sure you want to ${active ? 'activate' : 'deactivate'} this employee?`,
    active ? 'Activate' : 'Deactivate',
    active ? 'btn-success' : 'btn-danger'
  );
  if (!ok) return;
  try {
    await api(`/employees/${id}/status`, 'PATCH', { isActive: active });
    toast(`Employee ${active ? 'activated' : 'deactivated'}`);
    renderEmployees();
  } catch {}
}

// ══════════════════════════════════════════════════════════
// BUSES
// ══════════════════════════════════════════════════════════
function expiryCell(dateStr) {
  if (!dateStr) return '—';
  const today = new Date().toISOString().split('T')[0];
  const in30 = addDays(today, 30);
  let badge = '';
  if (dateStr < today) badge = '<span class="badge bg-danger ms-1">Expired</span>';
  else if (dateStr <= in30) badge = '<span class="badge bg-warning text-dark ms-1">Expiring Soon</span>';
  return dateStr + badge;
}

async function renderBuses() {
  shell('buses', `
    <div class="page-header">
      <div><h4><i class="fas fa-bus me-2"></i>Bus Management</h4>
        <div class="subtitle">Manage the bus fleet</div></div>
      <button class="btn btn-primary btn-sm" onclick="openAddBus()"><i class="fas fa-plus me-1"></i>Add Bus</button>
    </div>
    <div class="content-card">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead><tr><th>Bus Number</th><th>Plate No.</th><th>Model</th>
            <th>Franchise (CPC) Expiry</th><th>LTO Reg. Expiry</th><th>Insurance Expiry</th><th>Status</th>
            <th>Actions</th></tr></thead>
          <tbody id="busBody"><tr><td colspan="8" class="table-empty">
            <div class="spinner-border spinner-border-sm text-muted"></div></td></tr></tbody>
        </table>
      </div>
      <div id="busPager"></div>
    </div>
    ${getBusModal()}`);

  try {
    const buses = await api('/buses');
    window._buses = buses;
    renderBusRows(buses);
  } catch { renderBusRows([]); }
}

let _busPage = 1;

function renderBusRows(rows, resetPage = true) {
  const tbody = document.getElementById('busBody');
  if (!tbody) return;
  if (resetPage) _busPage = 1;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty"><i class="fas fa-bus"></i>No buses found</td></tr>`;
    document.getElementById('busPager').innerHTML = '';
    return;
  }
  _busPage = clampPage(rows.length, _busPage);
  tbody.innerHTML = paginate(rows, _busPage).map(b => `
    <tr>
      <td><strong>${b.busNumber}</strong></td>
      <td>${b.plateNo}</td>
      <td>${dash(b.model)}</td>
      <td>${expiryCell(b.franchiseExpiry)}</td>
      <td>${expiryCell(b.registrationExpiry)}</td>
      <td>${expiryCell(b.insuranceExpiry)}</td>
      <td><span class="status-badge ${{ACTIVE:'status-active',INACTIVE:'status-inactive',MAINTENANCE:'status-maintenance'}[b.status]||'status-inactive'}">${{ACTIVE:'Active',INACTIVE:'Inactive',MAINTENANCE:'Under Maintenance'}[b.status]||b.status}</span></td>
      <td class="d-flex gap-1 flex-wrap">
        <button class="btn btn-outline-primary btn-icon" onclick="openEditBus(${b.id})" title="Edit"><i class="fas fa-edit"></i></button>
        ${b.status !== 'ACTIVE'      ? `<button class="btn btn-outline-success btn-icon" onclick="setBusStatus(${b.id},'ACTIVE')" title="Activate"><i class="fas fa-check"></i></button>` : ''}
        ${b.status !== 'MAINTENANCE' ? `<button class="btn btn-outline-warning btn-icon" onclick="setBusStatus(${b.id},'MAINTENANCE')" title="Set Maintenance"><i class="fas fa-wrench"></i></button>` : ''}
        ${b.status !== 'INACTIVE'    ? `<button class="btn btn-outline-danger btn-icon" onclick="setBusStatus(${b.id},'INACTIVE')" title="Deactivate"><i class="fas fa-ban"></i></button>` : ''}
      </td>
    </tr>`).join('');
  renderPager('busPager', rows.length, _busPage, 'changeBusPage');
}

function changeBusPage(p) {
  _busPage = p;
  renderBusRows(window._buses || [], false);
}

function getBusModal() {
  return `
  <div class="modal fade" id="busModal" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="busModalTitle">Add Bus</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="busId">
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label">Bus Number *</label>
              <input type="text" id="busNum" class="form-control" placeholder="e.g. 0001">
            </div>
            <div class="col-md-6">
              <label class="form-label">Plate Number *</label>
              <input type="text" id="busPlate" class="form-control" placeholder="e.g. ABC-1234">
            </div>
            <div class="col-12">
              <label class="form-label">Model</label>
              <input type="text" id="busModel" class="form-control" placeholder="e.g. Hino RK8">
            </div>
            <div class="col-12"><hr class="my-1"><div class="text-muted small fw-bold">Compliance Documents</div></div>
            <div class="col-md-6">
              <label class="form-label">Franchise (CPC) No.</label>
              <input type="text" id="busFranchiseNo" class="form-control" placeholder="e.g. CPC-2023-0145">
            </div>
            <div class="col-md-6">
              <label class="form-label">Franchise (CPC) Expiry</label>
              <input type="date" id="busFranchiseExpiry" class="form-control">
            </div>
            <div class="col-md-4">
              <label class="form-label">LTO Registration (OR/CR) Expiry</label>
              <input type="date" id="busRegExpiry" class="form-control">
            </div>
            <div class="col-md-4">
              <label class="form-label">CTPL Insurance Policy No.</label>
              <input type="text" id="busInsuranceNo" class="form-control" placeholder="e.g. CTPL-88210456">
            </div>
            <div class="col-md-4">
              <label class="form-label">CTPL Insurance Expiry</label>
              <input type="date" id="busInsuranceExpiry" class="form-control">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
          <button class="btn btn-primary btn-sm" onclick="saveBus()"><i class="fas fa-save me-1"></i>Save</button>
        </div>
      </div>
    </div>
  </div>`;
}

function openAddBus() {
  document.getElementById('busModalTitle').textContent = 'Add Bus';
  document.getElementById('busId').value = '';
  ['busNum','busPlate','busModel','busFranchiseNo','busFranchiseExpiry','busRegExpiry','busInsuranceNo','busInsuranceExpiry']
    .forEach(id => document.getElementById(id).value = '');
  new bootstrap.Modal(document.getElementById('busModal')).show();
}

function openEditBus(id) {
  const bus = (window._buses || []).find(b => b.id === id);
  if (!bus) return;
  document.getElementById('busModalTitle').textContent = 'Edit Bus';
  document.getElementById('busId').value = id;
  document.getElementById('busNum').value = bus.busNumber;
  document.getElementById('busPlate').value = bus.plateNo;
  document.getElementById('busModel').value = bus.model || '';
  document.getElementById('busFranchiseNo').value = bus.franchiseNo || '';
  document.getElementById('busFranchiseExpiry').value = bus.franchiseExpiry || '';
  document.getElementById('busRegExpiry').value = bus.registrationExpiry || '';
  document.getElementById('busInsuranceNo').value = bus.insuranceNo || '';
  document.getElementById('busInsuranceExpiry').value = bus.insuranceExpiry || '';
  new bootstrap.Modal(document.getElementById('busModal')).show();
}

async function saveBus() {
  const id = document.getElementById('busId').value;
  const body = {
    busNumber: document.getElementById('busNum').value.trim(),
    plateNo:   document.getElementById('busPlate').value.trim(),
    model:     document.getElementById('busModel').value.trim(),
    franchiseNo:        document.getElementById('busFranchiseNo').value.trim(),
    franchiseExpiry:    document.getElementById('busFranchiseExpiry').value,
    registrationExpiry: document.getElementById('busRegExpiry').value,
    insuranceNo:        document.getElementById('busInsuranceNo').value.trim(),
    insuranceExpiry:    document.getElementById('busInsuranceExpiry').value
  };
  if (!body.busNumber || !body.plateNo) { toast('Bus number and plate are required', 'warning'); return; }
  if (id) {
    const ok = await confirmModal('Update Bus', 'Save changes to this bus record?', 'Save Changes', 'btn-primary');
    if (!ok) return;
  }
  try {
    if (id) { await api(`/buses/${id}`, 'PUT', body); toast('Bus updated'); }
    else    { await api('/buses', 'POST', body); toast('Bus added'); }
    bootstrap.Modal.getInstance(document.getElementById('busModal')).hide();
    renderBuses();
  } catch {}
}

async function setBusStatus(id, status) {
  const labels  = { ACTIVE: 'Activate', INACTIVE: 'Deactivate', MAINTENANCE: 'Set Under Maintenance' };
  const classes = { ACTIVE: 'btn-success', INACTIVE: 'btn-danger', MAINTENANCE: 'btn-warning' };
  const ok = await confirmModal(
    `${labels[status] || status} Bus`,
    `Are you sure you want to ${(labels[status] || status).toLowerCase()} this bus?`,
    labels[status] || status,
    classes[status] || 'btn-secondary'
  );
  if (!ok) return;
  try {
    await api(`/buses/${id}/status`, 'PATCH', { status });
    toast(`Bus status updated to ${status.toLowerCase()}`);
    renderBuses();
  } catch {}
}

// ══════════════════════════════════════════════════════════
// REPORTS
// ══════════════════════════════════════════════════════════
async function renderReports() {
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = today.slice(0,8) + '01';

  shell('reports', `
    <div class="page-header">
      <div><h4><i class="fas fa-chart-bar me-2"></i>Reports</h4>
        <div class="subtitle">Financial and operational summaries</div></div>
    </div>
    <div class="content-card mb-3">
      <div class="table-toolbar">
        <label class="form-label mb-0 me-1" style="white-space:nowrap;font-size:0.8rem">From:</label>
        <input type="date" id="rFrom" class="form-control form-control-sm" style="max-width:150px" value="${firstOfMonth}">
        <label class="form-label mb-0 me-1" style="white-space:nowrap;font-size:0.8rem">To:</label>
        <input type="date" id="rTo" class="form-control form-control-sm" style="max-width:150px" value="${today}">
        <button class="btn btn-primary btn-sm" onclick="loadReport('summary')">Summary</button>
        <button class="btn btn-outline-primary btn-sm" onclick="loadReport('trips')">Trip Report</button>
        <button class="btn btn-outline-warning btn-sm" onclick="loadReport('low-income')">Low Income</button>
        ${isAdmin() ? `<button class="btn btn-outline-secondary btn-sm" onclick="loadReport('changelog')">Changelogs</button>` : ''}
        <button class="btn btn-success btn-sm ms-auto" onclick="downloadReportPDF()"><i class="fas fa-file-pdf me-1"></i>Generate Report</button>
      </div>
    </div>
    <div id="reportContent"></div>`);

  // Auto-load summary
  loadReport('summary');
}

let _reportRows = [], _reportType = '', _reportPage = 1;

async function loadReport(type) {
  const from = document.getElementById('rFrom').value;
  const to   = document.getElementById('rTo').value;
  if (!from || !to) { toast('Select date range', 'warning'); return; }

  const cont = document.getElementById('reportContent');
  cont.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';

  try {
    if (type === 'summary') {
      const s = await api(`/reports/summary?from=${from}&to=${to}`);
      cont.innerHTML = `
        <div class="report-summary">
          <div class="sum-row">
            <div class="sum-item"><div class="sum-label">Total Trips</div><div class="sum-value">${s.totalTrips ?? 0}</div></div>
            <div class="sum-item"><div class="sum-label">Gross Income</div><div class="sum-value">${peso(s.totalGrossIncome)}</div></div>
            <div class="sum-item"><div class="sum-label">Net Income</div><div class="sum-value">${peso(s.totalNetIncome)}</div></div>
            <div class="sum-item"><div class="sum-label">Total Expenses</div><div class="sum-value">${peso(s.totalExpenses)}</div></div>
            <div class="sum-item"><div class="sum-label">Net Profit</div><div class="sum-value">${peso(s.totalNetProfit)}</div></div>
            <div class="sum-item"><div class="sum-label">Avg Gross/Trip</div><div class="sum-value">${peso(s.avgGrossIncome)}</div></div>
          </div>
        </div>`;
    } else if (type === 'trips') {
      _reportRows = await api(`/reports/trips?from=${from}&to=${to}`);
      _reportType = 'trips';
      _reportPage = 1;
      renderReportRows();
    } else if (type === 'low-income') {
      _reportRows = await api(`/reports/low-income?from=${from}&to=${to}`);
      _reportType = 'low-income';
      _reportPage = 1;
      renderReportRows();
    } else if (type === 'changelog') {
      _reportRows = await api(`/reports/changelog?from=${from}&to=${to}`);
      _reportType = 'changelog';
      _reportPage = 1;
      renderReportRows();
    }
  } catch {
    cont.innerHTML = '<div class="alert alert-danger">Failed to load report.</div>';
  }
}

function renderReportRows() {
  const cont = document.getElementById('reportContent');
  const rows = _reportRows;
  _reportPage = clampPage(rows.length, _reportPage);
  const pageRows = paginate(rows, _reportPage);

  let html;
  if (_reportType === 'trips') {
    html = `
      <div class="content-card">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead><tr><th>Date</th><th>Bus</th><th>Driver</th><th>Conductor</th>
              <th>Trips</th><th>Gross</th><th>Net Income</th><th>Expenses</th><th>Net Profit</th><th>Modified</th></tr></thead>
            <tbody>${!rows.length ? `<tr><td colspan="10" class="table-empty">No data for selected range</td></tr>` :
              pageRows.map(r => `<tr>
                <td>${r.tripDate}</td><td>${r.busNumber}</td><td>${r.driverName}</td><td>${r.conductorName}</td>
                <td class="text-center">${r.tripCount}</td>
                <td>${peso(r.grossIncome)}</td><td>${peso(r.netIncome)}</td>
                <td>${peso(r.totalExpenses)}</td>
                <td class="${(r.netProfit||0)<0?'text-danger fw-bold':''}">${peso(r.netProfit)}</td>
                <td>${statusBadge(r.status)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div id="reportPager"></div>
      </div>`;
  } else if (_reportType === 'low-income') {
    html = `
      <div class="alert alert-warning py-2 px-3 mb-2" style="font-size:0.8rem">
        <i class="fas fa-exclamation-triangle me-1"></i>Showing trips where Gross Income < ₱13,000 (below quota)
    </div>
    <div class="content-card">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead><tr><th>Date</th><th>Bus</th><th>Driver</th><th>Conductor</th><th>Gross Income</th><th>Net Income</th></tr></thead>
            <tbody>${!rows.length ? `<tr><td colspan="6" class="table-empty"><i class="fas fa-check-circle text-success"></i>No low-income trips!</td></tr>` :
              pageRows.map(r => `<tr>
                <td>${r.tripDate}</td><td>${r.busNumber}</td><td>${r.driverName}</td><td>${r.conductorName}</td>
                <td class="text-danger fw-bold">${peso(r.grossIncome)}</td><td>${peso(r.netIncome)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div id="reportPager"></div>
      </div>`;
  } else if (_reportType === 'changelog') {
    html = `
      <div class="content-card">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead><tr><th>Date</th><th>Trip ID</th><th>Changed By</th><th>Type</th><th>Changed At</th><th>Details</th></tr></thead>
            <tbody>${!rows.length ? `<tr><td colspan="6" class="table-empty">No edits in this period</td></tr>` :
              pageRows.map((r, i) => {
                const diffRows = changelogDiffRows(r);
                const mainRow = `<tr>
                  <td>${r.tripDate}</td><td>#${r.tripId}</td><td>${escapeHtml(r.changedByName)}</td>
                  <td><span class="status-badge status-modified">${r.changeType}</span></td>
                  <td>${r.changedAt ? new Date(r.changedAt).toLocaleString('en-PH') : '—'}</td>
                  <td>${diffRows.length
                    ? `<button type="button" class="btn btn-sm btn-outline-secondary" onclick="toggleChangelogDiff(this, ${i})"><i class="fas fa-eye"></i> View</button>`
                    : '—'}</td>
                </tr>`;
                const diffRow = diffRows.length ? `<tr id="changelogDiff${i}" style="display:none">
                  <td colspan="6">
                    <table class="table table-sm mb-0">
                      <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
                      <tbody>${diffRows.map(d => `<tr><td>${d.label}</td><td>${escapeHtml(d.before)}</td><td>${escapeHtml(d.after)}</td></tr>`).join('')}</tbody>
                    </table>
                  </td>
                </tr>` : '';
                return mainRow + diffRow;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div id="reportPager"></div>
      </div>`;
  }
  cont.innerHTML = html;
  renderPager('reportPager', rows.length, _reportPage, 'changeReportPage');
}

function changeReportPage(p) {
  _reportPage = p;
  renderReportRows();
}

// ── PDF Download ─────────────────────────────────────────────
function pdfPeso(v) {
  return v == null || v === '—' ? '—' : 'PHP ' + Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

async function downloadReportPDF() {
  const from = document.getElementById('rFrom').value;
  const to   = document.getElementById('rTo').value;
  if (!from || !to) { toast('Select date range', 'warning'); return; }

  toast('Generating PDF…', 'info');

  try {
    const [summary, trips, lowIncome] = await Promise.all([
      api(`/reports/summary?from=${from}&to=${to}`),
      api(`/reports/trips?from=${from}&to=${to}`),
      api(`/reports/low-income?from=${from}&to=${to}`)
    ]);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth();

    // ── Header ──────────────────────────────────────────────
    doc.setFontSize(16);
    doc.setTextColor(0, 51, 102);
    doc.text('Metrolink FOMS — Financial Report', pageW / 2, 18, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`Period: ${from} to ${to}  |  Generated: ${new Date().toLocaleString('en-PH')}`, pageW / 2, 25, { align: 'center' });

    // ── Summary Section ─────────────────────────────────────
    let y = 33;
    doc.setFontSize(13);
    doc.setTextColor(0, 51, 102);
    doc.text('Summary', 14, y);
    y += 5;

    const sumRows = [
      ['Total Trips', String(summary.totalTrips ?? 0),
       'Gross Income', pdfPeso(summary.totalGrossIncome)],
      ['Net Income', pdfPeso(summary.totalNetIncome),
       'Total Expenses', pdfPeso(summary.totalExpenses)],
      ['Net Profit', pdfPeso(summary.totalNetProfit),
       'Avg Gross / Trip', pdfPeso(summary.avgGrossIncome)]
    ];
    doc.autoTable({
      startY: y,
      head: [],
      body: sumRows,
      theme: 'grid',
      tableWidth: pageW - 28,
      margin: { left: 14 },
      styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
      columnStyles: {
        0: { cellWidth: 30, halign: 'left', fontStyle: 'bold' },
        1: { cellWidth: (pageW - 28) / 4 - 30, halign: 'right' },
        2: { cellWidth: 30, halign: 'left', fontStyle: 'bold' },
        3: { cellWidth: (pageW - 28) / 4 - 30, halign: 'right' }
      },
      didParseCell(data) {
        // Highlight Net Profit row
        if (data.section === 'body' && data.row.index === 2) {
          if (data.column.index === 1 || data.column.index === 3) {
            const val = data.cell.raw === '—' ? 0 : parseFloat(String(data.cell.raw).replace(/[^0-9.-]/g, ''));
            if (val < 0) {
              data.cell.styles.textColor = [200, 0, 0];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      }
    });
    y = doc.lastAutoTable.finalY + 8;

    // ── Trip Report Section ─────────────────────────────────
    doc.setFontSize(13);
    doc.setTextColor(0, 51, 102);
    doc.text('Trip Report', 14, y);
    y += 5;

    if (!trips.length) {
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text('No trip data available for the selected period.', 14, y + 5);
    } else {
      const tripBody = trips.map(r => [
        r.tripDate || '—',
        r.busNumber || '—',
        r.driverName || '—',
        r.conductorName || '—',
        String(r.tripCount ?? 0),
        pdfPeso(r.grossIncome),
        pdfPeso(r.netIncome),
        pdfPeso(r.totalExpenses),
        pdfPeso(r.netProfit),
        r.status || '—'
      ]);
      doc.autoTable({
        startY: y,
        head: [['Date', 'Bus', 'Driver', 'Conductor', 'Trips', 'Gross', 'Net Income', 'Expenses', 'Net Profit', 'Status']],
        body: tripBody,
        theme: 'striped',
        margin: { left: 14, right: 14 },
        headStyles: { fillColor: [0, 51, 102], fontSize: 8, halign: 'center' },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 14 },
          2: { cellWidth: 28 },
          3: { cellWidth: 28 },
          4: { cellWidth: 10, halign: 'center' },
          5: { cellWidth: 24, halign: 'right' },
          6: { cellWidth: 24, halign: 'right' },
          7: { cellWidth: 22, halign: 'right' },
          8: { cellWidth: 22, halign: 'right' },
          9: { cellWidth: 10, halign: 'center' }
        },
        didParseCell(data) {
          if (data.section === 'body' && data.column.index === 8) {
            const val = data.cell.raw === '—' ? 0 : parseFloat(String(data.cell.raw).replace(/[^0-9.-]/g, ''));
            if (val < 0) {
              data.cell.styles.textColor = [200, 0, 0];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });
    }
    y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : y + 15;

    // ── Low Income Section ──────────────────────────────────
    // Check if we need a new page
    if (y > 170) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(13);
    doc.setTextColor(0, 51, 102);
    doc.text('Low Income Trips (Below PHP 13,000 Quota)', 14, y);
    y += 5;

    // Warning note
    doc.setFontSize(8);
    doc.setTextColor(180, 100, 0);
    doc.text('Showing trips where Gross Income < PHP 13,000 (below quota)', 14, y);
    y += 5;

    if (!lowIncome.length) {
      doc.setFontSize(10);
      doc.setTextColor(0, 128, 0);
      doc.text('No low-income trips for the selected period.', 14, y + 5);
    } else {
      const liBody = lowIncome.map(r => [
        r.tripDate || '—',
        r.busNumber || '—',
        r.driverName || '—',
        r.conductorName || '—',
        pdfPeso(r.grossIncome),
        pdfPeso(r.netIncome)
      ]);
      doc.autoTable({
        startY: y,
        head: [['Date', 'Bus', 'Driver', 'Conductor', 'Gross Income', 'Net Income']],
        body: liBody,
        theme: 'striped',
        margin: { left: 14, right: 14 },
        headStyles: { fillColor: [180, 100, 0], fontSize: 8, halign: 'center' },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 20 },
          2: { cellWidth: 40 },
          3: { cellWidth: 40 },
          4: { cellWidth: 35, halign: 'right' },
          5: { cellWidth: 35, halign: 'right' }
        },
        didParseCell(data) {
          if (data.section === 'body' && (data.column.index === 4 || data.column.index === 5)) {
            data.cell.styles.textColor = [180, 0, 0];
          }
        }
      });
    }

    // ── Footer ──────────────────────────────────────────────
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Metrolink FOMS — Page ${i} of ${pageCount}`,
        pageW / 2, doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      );
    }

    doc.save(`Metrolink_Report_${from}_to_${to}.pdf`);
    toast('PDF downloaded!');
  } catch (e) {
    toast('Failed to generate PDF: ' + (e.message || e), 'danger');
  }
}

// ── Trip changelog before/after diff ────────────────────────
const CHANGELOG_FIELD_LABELS = {
  tripDate: 'Trip Date',
  busNumber: 'Bus',
  driverName: 'Driver',
  conductorName: 'Conductor',
  dispatchTime: 'Dispatch Time',
  arrivalTime: 'Arrival Time',
  arrivalDate: 'Arrival Date',
  tripCount: 'Trip Count',
  remarks: 'Remarks',
};

function changelogValueDisplay(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(v)) return v.substring(0, 5);
  return String(v);
}

function changelogDiffRows(r) {
  if (r.changeType !== 'TRIP_DETAILS' || !r.oldValue || !r.newValue) return [];
  let oldObj, newObj;
  try {
    oldObj = typeof r.oldValue === 'string' ? JSON.parse(r.oldValue) : r.oldValue;
    newObj = typeof r.newValue === 'string' ? JSON.parse(r.newValue) : r.newValue;
  } catch {
    return [];
  }
  const out = [];
  for (const [key, label] of Object.entries(CHANGELOG_FIELD_LABELS)) {
    const before = changelogValueDisplay(oldObj[key]);
    const after = changelogValueDisplay(newObj[key]);
    if (before !== after) out.push({ label, before, after });
  }
  return out;
}

function toggleChangelogDiff(btn, i) {
  const row = document.getElementById(`changelogDiff${i}`);
  if (!row) return;
  if (row.style.display === 'none') {
    row.style.display = '';
    btn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide';
  } else {
    row.style.display = 'none';
    btn.innerHTML = '<i class="fas fa-eye"></i> View';
  }
}

// ══════════════════════════════════════════════════════════
// HELP / USER GUIDE
// ══════════════════════════════════════════════════════════
const FEATURE_GUIDE = [
  {
    id: 'dashboard', icon: 'fa-th-large', title: 'Dashboard', roles: ['ADMIN', 'STAFF'],
    summary: 'Your landing page — a quick overview of company performance: trip volume, income, expenses and profit trends.',
    steps: [
      'Open from the sidebar — this is also the page you land on after logging in.',
      'Check the stat cards at the top for at-a-glance totals (trips, gross income, expenses, profit).',
      'Use the charts to spot trends in trip volume and income over time.',
      'Admins additionally see a "Recent Activity" panel showing the latest changes made across the system.',
    ],
  },
  {
    id: 'trips', icon: 'fa-route', title: 'Trip Management', roles: ['ADMIN', 'STAFF'],
    summary: 'Record each bus trip for the day, including the bus, crew, and the income/expenses it generated.',
    steps: [
      'Click "Add Trip" and fill in the trip date, bus number, driver, conductor, and income/expense details across the form tabs.',
      'Save the trip — it will appear in the table, which you can search by bus/driver or filter by date.',
      'Use the refresh button to reload the latest trips from the server.',
      'Admins can click the edit icon on any row to correct a previously logged trip; edits are tracked and flagged as "Modified".',
    ],
  },
  {
    id: 'employees', icon: 'fa-users', title: 'Employees', roles: ['ADMIN', 'STAFF'],
    summary: 'Browse the roster of drivers, conductors and other staff, including their rates and status.',
    steps: [
      'Search by name/code or filter by position (Driver/Conductor) using the toolbar above the table.',
      'Each row shows the employee\'s code, position badge, daily/bi-monthly rate, and active/inactive status.',
      'Admins can click "Add Employee" to register a new staff member, the edit icon to update their details, and the toggle icon to activate or deactivate an account.',
    ],
  },
  {
    id: 'buses', icon: 'fa-bus', title: 'Buses', roles: ['ADMIN', 'STAFF'],
    summary: 'View the bus fleet and each unit\'s current operating status.',
    steps: [
      'Browse the table to see every bus number and whether it is currently active or inactive.',
      'Admins can click "Add Bus" to register a new unit, the edit icon to update its details, and the toggle icon to mark it active or inactive.',
    ],
  },
  {
    id: 'reports', icon: 'fa-chart-bar', title: 'Reports', roles: ['ADMIN', 'STAFF'],
    summary: 'Generate financial and operational summaries for any date range.',
    steps: [
      'Pick a "From" and "To" date, then choose a report type:',
      '"Summary" — totals for trips, gross/net income, expenses and profit for the period.',
      '"Trip Report" — a per-trip breakdown of income, expenses and profit.',
      '"Low Income" — flags trips that fell below the ₱13,000 quota so they can be reviewed.',
      'Admins additionally have a "Changelogs" report showing which trips were edited, by whom, and when.',
    ],
  },
  {
    id: 'finance', icon: 'fa-money-bill-wave', title: 'Finance', roles: ['ADMIN'],
    summary: 'Manage payroll and monitor company treasury — admin only.',
    steps: [
      'Use the period navigator (◀ ▶) at the top to move between bi-monthly pay periods.',
      '"Daily Payroll" — review computed pay for drivers/conductors based on logged trips, and mark records as paid.',
      '"Bi-Monthly" — review and process bi-monthly salaries for other staff positions.',
      '"Company Treasury" — view the running balance of company income versus expenses and payouts.',
      'Click the green check icon next to a pending payroll record to mark it as paid once disbursed.',
    ],
  },
  {
    id: 'users', icon: 'fa-user-cog', title: 'Staff Accounts', roles: ['ADMIN'],
    summary: 'Create and manage the login accounts that can access this system — admin only.',
    steps: [
      'Click "Add User" to register a new account — set their username, full name, password and role (Admin or Staff).',
      'Use the edit icon to update an account\'s details or reset its password.',
      'Assign the "Staff" role for day-to-day operational access, or "Admin" for full access including Finance, Staff Accounts, Audit Log and Backup.',
    ],
  },
  {
    id: 'audit', icon: 'fa-clipboard-list', title: 'Audit Log', roles: ['ADMIN'],
    summary: 'A read-only history of important changes made across the system — admin only.',
    steps: [
      'Pick a date range to view who changed what and when (e.g. trip edits, account changes).',
      'Use this page to investigate discrepancies or confirm that a particular change was made by the expected person.',
    ],
  },
  {
    id: 'backup', icon: 'fa-database', title: 'Backup', roles: ['ADMIN'],
    summary: 'Generate a downloadable snapshot of the entire database — admin only.',
    steps: [
      'Re-type your account password to confirm, then click "Generate & Download Backup" to run a database dump and download a .sql file containing all current data.',
      'Store the downloaded file somewhere safe — it can be used to restore the system in case of data loss.',
    ],
  },
];

function helpAccordionItem(f) {
  const collapseId = `help-collapse-${f.id}`;
  const headingId  = `help-heading-${f.id}`;
  return `
    <div class="accordion-item">
      <h2 class="accordion-header" id="${headingId}">
        <button class="accordion-button collapsed" type="button" aria-expanded="false"
          onclick="var p=document.getElementById('${collapseId}');var open=p.classList.toggle('show');this.classList.toggle('collapsed',!open);this.setAttribute('aria-expanded',String(open))">
          <i class="fas ${f.icon} me-2 text-primary"></i><strong>${f.title}</strong>
          ${f.roles.length === 1 ? '<span class="status-badge status-admin ms-2">Admin only</span>' : ''}
        </button>
      </h2>
      <div id="${collapseId}" class="help-panel" aria-labelledby="${headingId}">
        <div class="accordion-body">
          <p class="text-muted mb-2">${f.summary}</p>
          <ol class="mb-0 ps-3">
            ${f.steps.map(s => `<li class="mb-1">${s}</li>`).join('')}
          </ol>
        </div>
      </div>
    </div>`;
}

async function renderHelp() {
  const admin = isAdmin();
  const items = FEATURE_GUIDE.filter(f => f.roles.includes(admin ? 'ADMIN' : 'STAFF'));

  shell('help', `
    <div class="page-header">
      <div><h4><i class="fas fa-circle-question me-2"></i>Help &amp; User Guide</h4>
        <div class="subtitle">How to use Metrolink FOMS — tailored to your role</div></div>
    </div>
    <div class="alert alert-info py-2 px-3 mb-3" style="font-size:0.8rem">
      <i class="fas fa-circle-info me-1"></i>
      You're signed in as <strong>${admin ? 'Admin' : 'Staff'}</strong>. This guide only lists the features
      available to your account${admin ? '' : ' — Finance, Staff Accounts, Audit Log and Backup are restricted to admins'}.
    </div>
    <div class="content-card">
      <div class="accordion" id="helpAccordion">
        ${items.map(f => helpAccordionItem(f)).join('')}
      </div>
    </div>`);
}

// ══════════════════════════════════════════════════════════
// USERS (Admin only)
// ══════════════════════════════════════════════════════════
async function renderUsers() {
  if (!isAdmin()) { go('dashboard'); return; }
  shell('users', `
    <div class="page-header">
      <div><h4><i class="fas fa-user-cog me-2"></i>Staff Accounts</h4>
        <div class="subtitle">Manage system user accounts</div></div>
      <button class="btn btn-primary btn-sm" onclick="openAddUser()"><i class="fas fa-plus me-1"></i>Register Staff</button>
    </div>
    <div class="d-flex gap-2 mb-3 align-items-center flex-wrap">
      <select id="userRoleFilter" class="form-select form-select-sm" style="max-width:130px">
        <option value="">All Roles</option>
        <option value="ADMIN">Admin</option>
        <option value="STAFF">Staff</option>
      </select>
      <select id="userHireDateFilter" class="form-select form-select-sm" style="max-width:150px" onchange="toggleUserDateRangeInputs()">
        <option value="">All Hire Dates</option>
        <option value="missing">Missing</option>
        <option value="this-week">This Week</option>
        <option value="this-month">This Month</option>
        <option value="last-month">Last Month</option>
        <option value="this-year">This Year</option>
        <option value="custom">Custom Range</option>
      </select>
      <input type="date" id="userHireDateFrom" class="form-control form-control-sm" style="max-width:145px;display:none">
      <input type="date" id="userHireDateTo" class="form-control form-control-sm" style="max-width:145px;display:none">
      <select id="userStatusFilter" class="form-select form-select-sm" style="max-width:130px">
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <button class="btn btn-primary btn-sm" onclick="applyUserFilters()">
        <i class="fas fa-filter me-1"></i>Apply
      </button>
    </div>
    <div id="userHireDateWarning" class="alert alert-warning d-none mb-3 py-2 px-3" style="font-size:0.85rem" role="alert">
      <i class="fas fa-exclamation-triangle me-1"></i><span id="userHireDateWarningMsg"></span>
    </div>
    <div class="content-card">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead><tr><th>Username</th><th>Full Name</th><th>Role</th><th>Hire Date</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="userBody"><tr><td colspan="6" class="table-empty">
            <div class="spinner-border spinner-border-sm text-muted"></div></td></tr></tbody>
        </table>
      </div>
      <div id="userPager"></div>
    </div>
    ${getUserModal()}
    ${getMissingHireDateModal()}`);

  try {
    const users = await api('/users');
    window._users = users;
    renderUserRows(users);
    showMissingHireDateNotification(users);
  } catch { renderUserRows([]); }
}

let _userPage = 1;

function renderUserRows(rows, resetPage = true) {
  const tbody = document.getElementById('userBody');
  if (!tbody) return;
  if (resetPage) _userPage = 1;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty"><i class="fas fa-user-cog"></i>No users found</td></tr>`;
    document.getElementById('userPager').innerHTML = '';
    return;
  }
  _userPage = clampPage(rows.length, _userPage);
  const me = getUser();
  tbody.innerHTML = paginate(rows, _userPage).map(u => `
    <tr>
      <td><code>${u.username}</code></td>
      <td><strong>${u.fullName}</strong></td>
      <td><span class="status-badge ${u.role === 'ADMIN' ? 'status-admin' : 'status-staff'}">${u.role}</span></td>
      <td>${u.hireDate ? u.hireDate : '<span class="text-danger fw-bold">Not set</span>'}</td>
      <td><span class="status-badge ${u.isActive ? 'status-active' : 'status-inactive'}">${u.isActive ? 'Active' : 'Inactive'}</span></td>
      <td>
        <button class="btn btn-outline-primary btn-icon me-1" onclick="openEditUser(${u.id})" title="Edit"><i class="fas fa-edit"></i></button>
        <button class="btn btn-outline-info btn-icon me-1" onclick="openChangePass(${u.id},'${u.username}')" title="Change Password">
          <i class="fas fa-key"></i></button>
        ${u.id !== me?.userId ? `<button class="btn ${u.isActive ? 'btn-outline-danger' : 'btn-outline-success'} btn-icon"
          onclick="toggleUser(${u.id},${!u.isActive})" title="${u.isActive ? 'Deactivate' : 'Activate'}">
          <i class="fas ${u.isActive ? 'fa-ban' : 'fa-check'}"></i></button>` : ''}
      </td>
    </tr>`).join('');
  renderPager('userPager', rows.length, _userPage, 'changeUserPage');
}

function changeUserPage(p) {
  _userPage = p;
  renderUserRows(window._users || [], false);
}

function getUserModal() {
  return `
  <div class="modal fade" id="userModal" tabindex="-1">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="userModalTitle">Register Staff</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="userId">
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label">Username *</label>
              <input type="text" id="uUsername" class="form-control" placeholder="login username">
            </div>
            <div class="col-md-6">
              <label class="form-label">Role *</label>
              <select id="uRole" class="form-select">
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div class="col-md-8">
              <label class="form-label">Full Name *</label>
              <input type="text" id="uFullName" class="form-control" placeholder="Last Name, First Name">
            </div>
            <div class="col-md-4">
              <label class="form-label">Birthdate</label>
              <input type="date" id="uBirthdate" class="form-control">
            </div>
            <div class="col-md-4">
              <label class="form-label">Hire Date *</label>
              <input type="date" id="uHireDate" class="form-control" required>
            </div>
            <div class="col-md-4">
              <label class="form-label">Email</label>
              <input type="email" id="uEmail" class="form-control" placeholder="email@example.com">
            </div>
            <div class="col-md-6" id="uPassRow">
              <label class="form-label">Password *</label>
              <input type="password" id="uPassword" class="form-control" placeholder="Set initial password">
            </div>
            <div class="col-12">
              <label class="form-label">Address</label>
              <input type="text" id="uAddress" class="form-control" placeholder="Street, City">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
          <button class="btn btn-primary btn-sm" onclick="saveUser()"><i class="fas fa-save me-1"></i>Save</button>
        </div>
      </div>
    </div>
  </div>
  <div class="modal fade" id="passModal" tabindex="-1">
    <div class="modal-dialog modal-sm">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Change Password</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="passUserId">
          <p class="small text-muted mb-3">Changing password for: <strong id="passUsername"></strong></p>
          <label class="form-label">New Password *</label>
          <input type="password" id="newPassword" class="form-control" placeholder="Enter new password">
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
          <button class="btn btn-primary btn-sm" onclick="savePassword()">Save</button>
        </div>
      </div>
    </div>
  </div>`;
}

function openAddUser() {
  document.getElementById('userModalTitle').textContent = 'Register Staff';
  document.getElementById('userId').value = '';
  document.getElementById('uPassRow').style.display = '';
  ['uUsername','uFullName','uPassword','uBirthdate','uHireDate','uEmail','uAddress'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('uRole').value = 'STAFF';
  document.getElementById('uUsername').disabled = false;
  new bootstrap.Modal(document.getElementById('userModal')).show();
}

function openEditUser(id) {
  const u = (window._users || []).find(u => u.id === id);
  if (!u) return;
  document.getElementById('userModalTitle').textContent = 'Edit Staff';
  document.getElementById('userId').value = id;
  document.getElementById('uUsername').value = u.username;
  document.getElementById('uUsername').disabled = true;
  document.getElementById('uFullName').value = u.fullName;
  document.getElementById('uBirthdate').value = u.birthdate || '';
  document.getElementById('uHireDate').value = u.hireDate || '';
  document.getElementById('uEmail').value = u.email || '';
  document.getElementById('uAddress').value = u.address || '';
  document.getElementById('uRole').value = u.role;
  document.getElementById('uPassRow').style.display = 'none';
  new bootstrap.Modal(document.getElementById('userModal')).show();
}

function getMissingHireDateModal() {
  return `
  <div class="modal fade" id="missingHireDateModal" tabindex="-1">
    <div class="modal-dialog modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header" style="background:#fff3cd;border-bottom:1px solid #ffc107">
          <h5 class="modal-title"><i class="fas fa-exclamation-triangle text-warning me-2"></i>Missing Hire Dates</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body" id="missingHireDateBody">
          <p class="small text-muted mb-2">The following staff accounts do not have a hire date set. Please update their records.</p>
          <table class="table table-sm mb-0">
            <thead><tr><th>Username</th><th>Full Name</th><th>Role</th><th></th></tr></thead>
            <tbody id="missingHireDateList"></tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Close</button>
        </div>
      </div>
    </div>
  </div>`;
}

function showMissingHireDateNotification(users) {
  const missing = users.filter(u => !u.hireDate);
  const warnEl = document.getElementById('userHireDateWarning');
  const warnMsg = document.getElementById('userHireDateWarningMsg');

  if (!missing.length) {
    if (warnEl) warnEl.classList.add('d-none');
    return;
  }

  // Persistent warning section
  if (warnEl && warnMsg) {
    warnMsg.innerHTML = `<strong>${missing.length}</strong> staff member${missing.length > 1 ? 's' : ''} ${missing.length > 1 ? 'do' : 'does'} not have a hire date set. <a href="#" onclick="showMissingHireDateModal()" class="alert-link">View details</a>`;
    warnEl.classList.remove('d-none');
  }

  // Populate modal list
  const list = document.getElementById('missingHireDateList');
  if (list) {
    list.innerHTML = missing.map(u => `
      <tr>
        <td><code>${u.username}</code></td>
        <td><strong>${u.fullName}</strong></td>
        <td><span class="status-badge ${u.role === 'ADMIN' ? 'status-admin' : 'status-staff'}">${u.role}</span></td>
        <td class="text-end">
          <button class="btn btn-outline-primary btn-sm" onclick="openEditUser(${u.id});bootstrap.Modal.getInstance(document.getElementById('missingHireDateModal')).hide()">
            <i class="fas fa-edit me-1"></i>Set Hire Date
          </button>
        </td>
      </tr>`).join('');
  }

  // Show modal on page load
  const modalEl = document.getElementById('missingHireDateModal');
  if (modalEl) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }
}

function showMissingHireDateModal() {
  const modalEl = document.getElementById('missingHireDateModal');
  if (modalEl) new bootstrap.Modal(modalEl).show();
}

// ── User filter helpers ──────────────────────────────────────
function toggleUserDateRangeInputs() {
  const val = document.getElementById('userHireDateFilter')?.value;
  const fromEl = document.getElementById('userHireDateFrom');
  const toEl = document.getElementById('userHireDateTo');
  if (!fromEl || !toEl) return;
  const show = val === 'custom';
  fromEl.style.display = show ? '' : 'none';
  toEl.style.display = show ? '' : 'none';
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = 0
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    from: monday.toISOString().split('T')[0],
    to: sunday.toISOString().split('T')[0]
  };
}

function applyUserFilters() {
  const roleVal    = document.getElementById('userRoleFilter')?.value;
  const hdVal      = document.getElementById('userHireDateFilter')?.value;
  const hdFrom     = document.getElementById('userHireDateFrom')?.value;
  const hdTo       = document.getElementById('userHireDateTo')?.value;
  const statusVal  = document.getElementById('userStatusFilter')?.value;

  let filtered = (window._users || []).filter(u => {
    if (roleVal && u.role !== roleVal) return false;

    if (statusVal === 'active' && !u.isActive) return false;
    if (statusVal === 'inactive' && u.isActive) return false;

    if (hdVal) {
      if (hdVal === 'missing') { if (u.hireDate) return false; }
      else if (hdVal === 'custom') {
        if (!u.hireDate) return false;
        if (hdFrom && u.hireDate < hdFrom) return false;
        if (hdTo && u.hireDate > hdTo) return false;
      } else {
        if (!u.hireDate) return false;
        const range = getWeekRange();
        const today = new Date().toISOString().split('T')[0];
        const thisMonth = today.slice(0, 7);
        const prev = new Date();
        prev.setMonth(prev.getMonth() - 1);
        const lastMonth = prev.toISOString().split('T')[0].slice(0, 7);
        const thisYear = today.slice(0, 4);
        if (hdVal === 'this-week' && (u.hireDate < range.from || u.hireDate > range.to)) return false;
        if (hdVal === 'this-month' && u.hireDate.slice(0, 7) !== thisMonth) return false;
        if (hdVal === 'last-month' && u.hireDate.slice(0, 7) !== lastMonth) return false;
        if (hdVal === 'this-year' && u.hireDate.slice(0, 4) !== thisYear) return false;
      }
    }

    return true;
  });

  renderUserRows(filtered);
}

async function saveUser() {
  const id = document.getElementById('userId').value;
  if (id) {
    const ok = await confirmModal('Update Staff Account', 'Save changes to this staff account?', 'Save Changes', 'btn-primary');
    if (!ok) return;
  }
  try {
    if (id) {
      await api(`/users/${id}`, 'PUT', {
        fullName:  document.getElementById('uFullName').value.trim(),
        birthdate: document.getElementById('uBirthdate').value || null,
        hireDate:  document.getElementById('uHireDate').value || null,
        address:   document.getElementById('uAddress').value.trim() || null,
        email:     document.getElementById('uEmail').value.trim() || null,
        role:      document.getElementById('uRole').value
      });
      toast('User updated');
    } else {
      await api('/users', 'POST', {
        username:  document.getElementById('uUsername').value.trim(),
        password:  document.getElementById('uPassword').value,
        fullName:  document.getElementById('uFullName').value.trim(),
        birthdate: document.getElementById('uBirthdate').value || null,
        hireDate:  document.getElementById('uHireDate').value || null,
        address:   document.getElementById('uAddress').value.trim() || null,
        email:     document.getElementById('uEmail').value.trim() || null,
        role:      document.getElementById('uRole').value
      });
      toast('Staff registered');
    }
    bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
    renderUsers();
  } catch {}
}

function openChangePass(id, username) {
  document.getElementById('passUserId').value = id;
  document.getElementById('passUsername').textContent = username;
  document.getElementById('newPassword').value = '';
  new bootstrap.Modal(document.getElementById('passModal')).show();
}

async function savePassword() {
  const id = document.getElementById('passUserId').value;
  const pw = document.getElementById('newPassword').value;
  if (!pw) { toast('Enter a new password', 'warning'); return; }
  const ok = await confirmModal('Change Password', 'Are you sure you want to change this password?', 'Change Password', 'btn-warning');
  if (!ok) return;
  try {
    await api(`/users/${id}/password`, 'PATCH', { newPassword: pw });
    toast('Password changed');
    bootstrap.Modal.getInstance(document.getElementById('passModal')).hide();
  } catch {}
}

async function toggleUser(id, active) {
  const ok = await confirmModal(
    `${active ? 'Activate' : 'Deactivate'} Account`,
    `Are you sure you want to ${active ? 'activate' : 'deactivate'} this user account?`,
    active ? 'Activate' : 'Deactivate',
    active ? 'btn-success' : 'btn-danger'
  );
  if (!ok) return;
  try {
    await api(`/users/${id}/status`, 'PATCH', { isActive: active });
    toast(`Account ${active ? 'activated' : 'deactivated'}`);
    renderUsers();
  } catch {}
}

// ══════════════════════════════════════════════════════════
// BACKUP (Admin only)
// ══════════════════════════════════════════════════════════
async function renderBackup() {
  if (!isAdmin()) { go('dashboard'); return; }
  shell('backup', `
    <div class="page-header">
      <div><h4><i class="fas fa-database me-2"></i>Database Backup</h4>
        <div class="subtitle">Generate and download a full SQL backup</div></div>
    </div>
    <div class="content-card p-4 text-center" style="max-width:500px;margin:0 auto">
      <i class="fas fa-database fa-4x text-primary mb-3" style="opacity:0.3"></i>
      <h5 class="mb-2">Backup metrolink_db</h5>
      <p class="text-muted small mb-4">
        This will run <code>mysqldump</code> and generate a downloadable <code>.sql</code> file
        containing all data from the database.
      </p>
      <div class="mb-3 text-start">
        <label class="form-label">Confirm your password to proceed</label>
        <div class="input-group">
          <span class="input-group-text"><i class="fas fa-lock"></i></span>
          <input type="password" id="backupPass" class="form-control" placeholder="Enter your account password">
          <button type="button" class="btn btn-pass-toggle" onclick="toggleBackupPass(this)" tabindex="-1" title="Show/hide password">
            <i class="fas fa-eye"></i>
          </button>
        </div>
      </div>
      <button class="btn btn-primary" onclick="doBackup(this)">
        <i class="fas fa-download me-2"></i>Generate &amp; Download Backup
      </button>
      <div id="backupStatus" class="mt-3"></div>
    </div>`);
}

function toggleBackupPass(btn) {
  const input = document.getElementById('backupPass');
  const icon  = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fas fa-eye-slash';
    btn.title = 'Hide password';
  } else {
    input.type = 'password';
    icon.className = 'fas fa-eye';
    btn.title = 'Show password';
  }
}

async function doBackup(btn) {
  const status = document.getElementById('backupStatus');
  const passInput = document.getElementById('backupPass');
  const password = passInput.value;
  if (!password) {
    status.innerHTML = '<div class="alert alert-warning py-2">Please enter your password to confirm.</div>';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generating…';
  status.innerHTML = '';
  try {
    const token = getToken();
    const res = await fetch(API + '/backup', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (!res.ok) {
      if (res.status === 401) { throw new Error('Incorrect password.'); }
      throw new Error('Backup failed');
    }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `metrolink_backup_${new Date().toISOString().slice(0,10)}.sql`;
    a.click();
    URL.revokeObjectURL(url);
    status.innerHTML = '<div class="alert alert-success py-2">Backup downloaded successfully!</div>';
    toast('Backup complete!');
    passInput.value = '';
  } catch (e) {
    status.innerHTML = `<div class="alert alert-danger py-2">${e.message === 'Incorrect password.' ? e.message : 'Backup failed. Check server logs.'}</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-download me-2"></i>Generate &amp; Download Backup';
  }
}

// ══════════════════════════════════════════════════════════
// AUDIT LOG (Admin only)
// ══════════════════════════════════════════════════════════
async function renderAudit() {
  if (!isAdmin()) { go('dashboard'); return; }
  const today = new Date().toISOString().split('T')[0];
  const thirtyAgo = new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0];
  shell('audit', `
    <div class="page-header">
      <div><h4><i class="fas fa-clipboard-list me-2"></i>Audit Log</h4>
        <div class="subtitle">System-wide action history</div></div>
    </div>
    <div class="card mb-3">
      <div class="card-body py-2 d-flex gap-2 align-items-end flex-wrap">
        <div>
          <label class="form-label mb-1 small">From</label>
          <input type="date" id="auditFrom" class="form-control form-control-sm" value="${thirtyAgo}">
        </div>
        <div>
          <label class="form-label mb-1 small">To</label>
          <input type="date" id="auditTo" class="form-control form-control-sm" value="${today}">
        </div>
        <button class="btn btn-primary btn-sm" onclick="loadAuditLog()">
          <i class="fas fa-search me-1"></i>Load
        </button>
      </div>
    </div>
    <div id="auditTableWrap"></div>
  `);
  loadAuditLog();
}

let _auditRows = [], _auditPage = 1;

async function loadAuditLog() {
  const from = document.getElementById('auditFrom').value;
  const to   = document.getElementById('auditTo').value;
  const wrap = document.getElementById('auditTableWrap');
  wrap.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Loading…</div>';
  try {
    _auditRows = await api(`/audit?from=${from}&to=${to}`);
    _auditPage = 1;
    renderAuditRows();
  } catch {
    wrap.innerHTML = '<div class="alert alert-danger">Failed to load audit log.</div>';
  }
}

function renderAuditRows() {
  const wrap = document.getElementById('auditTableWrap');
  if (!_auditRows.length) {
    wrap.innerHTML = '<div class="alert alert-info">No audit entries found for this period.</div>';
    return;
  }
  const actionBadge = a => {
    if (a.startsWith('LOGIN'))          return `<span class="badge bg-primary">${a}</span>`;
    if (a.startsWith('CREATE'))         return `<span class="badge bg-success">${a}</span>`;
    if (a.startsWith('UPDATE'))         return `<span class="badge bg-warning text-dark">${a}</span>`;
    return                                     `<span class="badge bg-danger">${a}</span>`;
  };
  _auditPage = clampPage(_auditRows.length, _auditPage);
  wrap.innerHTML = `
    <div class="table-responsive">
      <table class="table table-hover table-sm">
        <thead><tr>
          <th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>ID</th><th>Details</th>
        </tr></thead>
        <tbody>
          ${paginate(_auditRows, _auditPage).map(r => `<tr>
            <td class="text-nowrap">${r.loggedAt ? new Date(r.loggedAt).toLocaleString('en-PH') : '—'}</td>
            <td>${r.username}</td>
            <td>${actionBadge(r.action)}</td>
            <td>${r.entity || '—'}</td>
            <td>${r.entityId != null ? r.entityId : '—'}</td>
            <td>${r.details ? escapeHtml(r.details) : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div id="auditPager"></div>`;
  renderPager('auditPager', _auditRows.length, _auditPage, 'changeAuditPage');
}

function changeAuditPage(p) {
  _auditPage = p;
  renderAuditRows();
}

// ══════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════
let _dashChart = null, _dashChart2 = null, _dashChart3 = null;
let _dashCalYear, _dashCalMonth;
let _dashCalTrips = [], _dashCalEmployees = [];

async function renderDashboard() {
  const user        = getUser();
  const today       = new Date().toISOString().split('T')[0];
  const mtdStart    = today.slice(0, 8) + '01';
  const sevenAgo    = new Date(Date.now() -  6 * 864e5).toISOString().split('T')[0];
  const fourteenAgo = new Date(Date.now() - 13 * 864e5).toISOString().split('T')[0];
  const fourWeekAgo = new Date(Date.now() - 27 * 864e5).toISOString().split('T')[0];
  const dateLabel   = new Date().toLocaleDateString('en-PH', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  shell('dashboard', `
    <div class="page-header">
      <div>
        <h4><i class="fas fa-th-large me-2"></i>Dashboard</h4>
        <div class="subtitle">${dateLabel}</div>
      </div>
    </div>
    <div class="dash-welcome mb-3">
      <div>
        <div class="dash-name">Welcome back, ${user?.fullName || user?.username || 'User'}!</div>
        <div class="dash-role"><i class="fas fa-id-badge me-1"></i>${user?.role || ''}</div>
      </div>
      <div class="dash-welcome-date">
        ${new Date().toLocaleDateString('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
      </div>
    </div>
    <div class="row g-3 mb-3" id="dashStats">
      <div class="col-6 col-md-3"><div class="stat-card blue"><div class="stat-label">Gross Income (MTD)</div><div class="stat-value" id="dGross">—</div><i class="fas fa-coins stat-icon-bg"></i></div></div>
      <div class="col-6 col-md-3"><div class="stat-card purple"><div class="stat-label">Total Trips (MTD)</div><div class="stat-value" id="dTrips">—</div><i class="fas fa-route stat-icon-bg"></i></div></div>
      <div class="col-6 col-md-3"><div class="stat-card red"><div class="stat-label">Total Expenses (MTD)</div><div class="stat-value" id="dExp">—</div><i class="fas fa-receipt stat-icon-bg"></i></div></div>
      <div class="col-6 col-md-3"><div class="stat-card green"><div class="stat-label">Net Profit (MTD)</div><div class="stat-value" id="dProfit">—</div><i class="fas fa-chart-line stat-icon-bg"></i></div></div>
    </div>

    <!-- Row 1: Income vs Expenses line chart + Today's Trips -->
    <div class="row g-3 mb-3">
      <div class="col-md-8">
        <div class="content-card p-3">
          <div class="dash-section-label">Income vs. Expenses — Last 14 Days</div>
          <div class="dash-chart-wrap tall"><canvas id="dashChart"></canvas></div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="content-card p-3">
          <div class="dash-section-label">Today's Trips</div>
          <div id="dashTodayTrips"><div class="text-muted small">Loading…</div></div>
        </div>
      </div>
    </div>

    <!-- Row 1.5: Fleet Availability Today -->
    <div class="row g-3 mb-3">
      <div class="col-md-4">
        <div class="content-card p-3">
          <div class="dash-section-label">Available Buses Today <span class="badge bg-secondary ms-1" id="dashAvailBusCount">—</span></div>
          <div id="dashAvailBuses" class="dash-avail-list"><div class="text-muted small">Loading…</div></div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="content-card p-3">
          <div class="dash-section-label">Available Drivers Today <span class="badge bg-secondary ms-1" id="dashAvailDriverCount">—</span></div>
          <div id="dashAvailDrivers" class="dash-avail-list"><div class="text-muted small">Loading…</div></div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="content-card p-3">
          <div class="dash-section-label">Available Conductors Today <span class="badge bg-secondary ms-1" id="dashAvailConductorCount">—</span></div>
          <div id="dashAvailConductors" class="dash-avail-list"><div class="text-muted small">Loading…</div></div>
        </div>
      </div>
    </div>

    <!-- Row 1.75: Monthly Operator Availability Calendar -->
    <div class="row g-3 mb-3">
      <div class="col-12">
        <div class="content-card p-3">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div class="dash-section-label mb-0"><i class="fas fa-calendar-alt me-1"></i>Operator Availability — <span id="dashCalMonth"></span></div>
            <div>
              <button class="btn btn-outline-secondary btn-sm me-1" onclick="dashCalNav(-1)" title="Previous month"><i class="fas fa-chevron-left"></i></button>
              <button class="btn btn-outline-secondary btn-sm" onclick="dashCalNav(1)" title="Next month"><i class="fas fa-chevron-right"></i></button>
            </div>
          </div>
          <div id="dashCalGrid" style="min-height:80px"><div class="text-muted small">Loading...</div></div>
        </div>
      </div>
    </div>

    <!-- Row 2: Trip Volume by Day of Week + Payroll Breakdown -->
    <div class="row g-3 mb-3">
      <div class="col-md-6">
        <div class="content-card p-3">
          <div class="dash-section-label">Trip Volume by Day of Week — Last 4 Weeks</div>
          <div class="dash-chart-wrap"><canvas id="dashChart2"></canvas></div>
        </div>
      </div>
      ${isAdmin() ? `
      <div class="col-md-6">
        <div class="content-card p-3">
          <div class="dash-section-label">Payroll Cost Breakdown (MTD)</div>
          <div class="dash-chart-wrap" id="dashChart3Wrap"><canvas id="dashChart3"></canvas></div>
        </div>
      </div>` : ''}
    </div>

    ${isAdmin() ? `
    <div class="content-card p-3 mb-3">
      <div class="dash-section-label">Recent Activity</div>
      <div id="dashActivity"><div class="text-muted small">Loading...</div></div>
    </div>` : ''}

  <!-- Day-click modal for calendar -->
  <div class="modal fade" id="dashCalModal" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h6 class="modal-title"><i class="fas fa-users me-1"></i>Available Operators — <span id="dashCalModalDate"></span></h6>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body" id="dashCalModalBody"></div>
      </div>
    </div>
  </div>
  `);

  [_dashChart, _dashChart2, _dashChart3].forEach(c => { if (c) c.destroy(); });
  _dashChart = _dashChart2 = _dashChart3 = null;

  try {
    const [summary, todayTrips, tripReport14, tripReport28, payrollSummary, auditLog, availableStaff] = await Promise.all([
      api(`/reports/summary?from=${mtdStart}&to=${today}`),
      api(`/trips/date?date=${today}`),
      api(`/reports/trips?from=${fourteenAgo}&to=${today}`),
      api(`/reports/trips?from=${fourWeekAgo}&to=${today}`),
      isAdmin() ? api(`/payroll/summary?from=${mtdStart}&to=${today}`) : Promise.resolve(null),
      isAdmin() ? api(`/audit?from=${sevenAgo}&to=${today}`) : Promise.resolve([]),
      api(`/trips/available-staff?date=${today}`)
    ]);

    // ── Stat cards ──
    document.getElementById('dGross').textContent  = peso(summary.totalGrossIncome);
    document.getElementById('dTrips').textContent  = summary.totalTrips ?? '0';
    document.getElementById('dExp').textContent    = peso(summary.totalExpenses);
    document.getElementById('dProfit').textContent = peso(summary.totalNetProfit);

    // ── Calendar: operator availability this month ──
    const now = new Date();
    if (_dashCalYear == null) { _dashCalYear = now.getFullYear(); _dashCalMonth = now.getMonth(); }
    dashCalFetch();

    // ── Chart 1: Income vs Expenses — last 14 days ──
    const byDate14 = {};
    (tripReport14 || []).forEach(r => {
      const d = r.tripDate;
      if (!byDate14[d]) byDate14[d] = { gross: 0, exp: 0, profit: 0 };
      const g = Number(r.grossIncome || 0);
      const p = Number(r.netProfit   || 0);
      byDate14[d].gross  += g;
      byDate14[d].exp    += (g - p);
      byDate14[d].profit += p;
    });
    const labels14 = [], grossArr = [], expArr = [], profitArr = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5).toISOString().split('T')[0];
      labels14.push(new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month:'short', day:'numeric' }));
      grossArr.push(byDate14[d]?.gross  || 0);
      expArr.push(byDate14[d]?.exp      || 0);
      profitArr.push(byDate14[d]?.profit || 0);
    }
    _dashChart = new Chart(document.getElementById('dashChart').getContext('2d'), {
      type: 'line',
      data: {
        labels: labels14,
        datasets: [
          { label: 'Gross Income', data: grossArr,  borderColor: '#1e88e5', backgroundColor: 'rgba(30,136,229,0.10)', tension: 0.4, fill: true,  pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#1e88e5', borderWidth: 2.5 },
          { label: 'Expenses',     data: expArr,    borderColor: '#e53935', backgroundColor: 'rgba(229,57,53,0.08)',  tension: 0.4, fill: true,  pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#e53935', borderWidth: 2.5 },
          { label: 'Net Profit',   data: profitArr, borderColor: '#43a047', backgroundColor: 'rgba(67,160,71,0.0)',  tension: 0.4, fill: false, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#43a047', borderWidth: 2, borderDash: [6, 3] }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top', align: 'end',
            labels: { font: { size: 11, weight: '500' }, boxWidth: 28, boxHeight: 3, padding: 16, usePointStyle: false }
          },
          tooltip: {
            backgroundColor: 'rgba(28,28,38,0.90)', titleFont: { size: 11 }, bodyFont: { size: 11 },
            padding: 10, cornerRadius: 8, caretSize: 5,
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ₱${Number(ctx.raw).toLocaleString('en-PH')}` }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
            ticks: { font: { size: 10 }, maxRotation: 40, color: '#9e9e9e' }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
            ticks: {
              callback: v => { const n = Number(v); return n >= 1000 ? '₱' + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k' : '₱' + n; },
              font: { size: 10 }, color: '#9e9e9e', maxTicksLimit: 6
            }
          }
        }
      }
    });

    // ── Chart 2: Trip Volume by Day of Week — last 28 days ──
    const dayTotals = [0,0,0,0,0,0,0]; // Sun=0 … Sat=6
    const dayCountedDates = {};
    (tripReport28 || []).forEach(r => {
      if (!dayCountedDates[r.tripDate]) dayCountedDates[r.tripDate] = 0;
      dayCountedDates[r.tripDate]++;
    });
    Object.entries(dayCountedDates).forEach(([d, count]) => {
      dayTotals[new Date(d + 'T00:00:00').getDay()] += count;
    });
    // Reorder Mon→Sun
    const dowLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const dowData   = [1,2,3,4,5,6,0].map(i => dayTotals[i]);
    const dowColors = ['#3949ab','#3949ab','#3949ab','#3949ab','#3949ab','#f59e0b','#9fa8da'];
    _dashChart2 = new Chart(document.getElementById('dashChart2').getContext('2d'), {
      type: 'bar',
      data: {
        labels: dowLabels,
        datasets: [{
          label: 'Total Trips', data: dowData,
          backgroundColor: dowColors,
          borderRadius: 8, borderSkipped: false,
          hoverBackgroundColor: ['#283593','#283593','#283593','#283593','#283593','#d97706','#7986cb']
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(28,28,38,0.90)', bodyFont: { size: 11 },
            padding: 10, cornerRadius: 8,
            callbacks: { label: ctx => ` ${ctx.raw} trip${ctx.raw !== 1 ? 's' : ''}` }
          }
        },
        scales: {
          x: {
            grid: { display: false, drawBorder: false },
            ticks: { font: { size: 11, weight: '500' }, color: '#616161' }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
            ticks: { precision: 0, font: { size: 10 }, color: '#9e9e9e', maxTicksLimit: 5 }
          }
        }
      }
    });

    // ── Chart 3: Payroll Cost Breakdown — donut ──
    const wrap3 = document.getElementById('dashChart3Wrap');
    if (isAdmin() && payrollSummary) {
      const operWages = Number(payrollSummary.totalOperatorWages || 0);
      const fixedPay  = Number(payrollSummary.fixedStaffPayroll  || 0);
      const total     = operWages + fixedPay;
      if (total > 0) {
        _dashChart3 = new Chart(document.getElementById('dashChart3').getContext('2d'), {
          type: 'doughnut',
          data: {
            labels: ['Drivers & Conductors', 'HR / Ops / Mechanic'],
            datasets: [{
              data: [operWages, fixedPay],
              backgroundColor: ['#1e88e5', '#f97316'],
              hoverBackgroundColor: ['#1565c0', '#ea6c00'],
              hoverOffset: 8, borderWidth: 0, spacing: 3
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '66%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: { font: { size: 11, weight: '500' }, boxWidth: 12, boxHeight: 12, padding: 14, color: '#424242' }
              },
              tooltip: {
                backgroundColor: 'rgba(28,28,38,0.90)', bodyFont: { size: 11 },
                padding: 10, cornerRadius: 8,
                callbacks: { label: ctx => ` ${peso(ctx.raw)} (${((ctx.raw / total) * 100).toFixed(1)}%)` }
              }
            }
          }
        });
      } else {
        if (wrap3) wrap3.innerHTML = '<div class="text-muted small text-center py-5">No payroll data for this period.</div>';
      }
    } else if (!isAdmin() && wrap3) {
      wrap3.innerHTML = '<div class="text-muted small text-center py-5"><i class="fas fa-lock me-1"></i>Admin access required.</div>';
    }

    // ── Today's trips list ──
    const todayEl = document.getElementById('dashTodayTrips');
    if (todayEl) {
      todayEl.innerHTML = !todayTrips.length
        ? '<div class="text-muted small">No trips recorded today.</div>'
        : todayTrips.map(t => `
          <div class="dash-trip-row">
            <span><strong>${t.busNumber}</strong> &nbsp;${t.driverName}</span>
            <span class="text-muted">${t.dispatchTime ? t.dispatchTime.substring(0,5) : '—'}</span>
          </div>`).join('');
    }

    // ── Fleet availability today ──
    const availBuses      = availableStaff?.buses      || [];
    const availDrivers    = availableStaff?.drivers    || [];
    const availConductors = availableStaff?.conductors || [];

    document.getElementById('dashAvailBusCount').textContent = availBuses.length;
    document.getElementById('dashAvailBuses').innerHTML = availBuses.length
      ? availBuses.map(b => `<div class="dash-trip-row"><span><strong>${b.busNumber}</strong> &nbsp;${b.plateNo}</span></div>`).join('')
      : '<div class="text-muted small">No buses available today.</div>';

    document.getElementById('dashAvailDriverCount').textContent = availDrivers.length;
    document.getElementById('dashAvailDrivers').innerHTML = availDrivers.length
      ? availDrivers.map(d => `<div class="dash-trip-row"><span>${d.fullName}</span></div>`).join('')
      : '<div class="text-muted small">No drivers available today.</div>';

    document.getElementById('dashAvailConductorCount').textContent = availConductors.length;
    document.getElementById('dashAvailConductors').innerHTML = availConductors.length
      ? availConductors.map(c => `<div class="dash-trip-row"><span>${c.fullName}</span></div>`).join('')
      : '<div class="text-muted small">No conductors available today.</div>';

    // ── Recent activity (admin only) ──
    const actEl = document.getElementById('dashActivity');
    if (actEl) {
      const last5 = (auditLog || []).slice(0, 5);
      actEl.innerHTML = !last5.length
        ? '<div class="text-muted small">No recent activity.</div>'
        : last5.map(a => {
            const actionBadge = a.action.startsWith('LOGIN')   ? 'bg-primary'
                              : a.action.startsWith('CREATE')  ? 'bg-success'
                              : a.action.startsWith('UPDATE')  ? 'bg-warning text-dark'
                              : 'bg-danger';
            return `<div class="dash-activity-row">
              <span class="badge ${actionBadge}" style="font-size:0.65rem;min-width:90px">${a.action}</span>
              <span>${a.username}</span>
              <span class="text-muted ms-auto">${a.loggedAt ? new Date(a.loggedAt).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : ''}</span>
            </div>`;
          }).join('');
    }

  } catch (e) {
    console.error('Dashboard error:', e);
  }
}

// ── Calendar: Operator availability ────────────────────────
async function dashCalFetch() {
  try {
    const monthStart = `${_dashCalYear}-${String(_dashCalMonth + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(_dashCalYear, _dashCalMonth + 1, 0).getDate();
    const monthEnd = `${_dashCalYear}-${String(_dashCalMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    _dashCalTrips = await api(`/trips/range?from=${monthStart}&to=${monthEnd}`);
    _dashCalEmployees = await api('/employees');
    dashCalRender();
  } catch {
    document.getElementById('dashCalGrid').innerHTML = '<div class="text-muted small">Failed to load calendar data.</div>';
  }
}

function dashCalNav(delta) {
  _dashCalMonth += delta;
  if (_dashCalMonth < 0) { _dashCalMonth = 11; _dashCalYear--; }
  if (_dashCalMonth > 11) { _dashCalMonth = 0;  _dashCalYear++; }
  document.getElementById('dashCalGrid').innerHTML = '<div class="text-muted small">Loading...</div>';
  dashCalFetch();
}

function dashCalRender() {
  const grid = document.getElementById('dashCalGrid');
  if (!grid) return;

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('dashCalMonth').textContent = `${monthNames[_dashCalMonth]} ${_dashCalYear}`;

  const drivers   = _dashCalEmployees.filter(e => e.position === 'DRIVER'   && e.isActive);
  const conductors = _dashCalEmployees.filter(e => e.position === 'CONDUCTOR' && e.isActive);

  const firstDay = new Date(_dashCalYear, _dashCalMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(_dashCalYear, _dashCalMonth + 1, 0).getDate();
  const todayStr = `${_dashCalYear}-${String(_dashCalMonth + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

  // Header row
  let h = '<div class="dash-cal-header">';
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => { h += `<div class="dash-cal-hdr">${d}</div>`; });
  h += '</div>';

  // Body
  let b = '<div class="dash-cal-body">';
  for (let i = 0; i < firstDay; i++) b += '<div class="dash-cal-cell dash-cal-empty"></div>';

  let day = 1;
  while (day <= daysInMonth) {
    const dateStr = `${_dashCalYear}-${String(_dashCalMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;

    const dayTrips = _dashCalTrips.filter(t => t.tripDate === dateStr);
    const busyDriverIds = new Set(dayTrips.map(t => t.driverId));
    const busyConductorIds = new Set(dayTrips.map(t => t.conductorId));

    const availDrivers = drivers.filter(d => !busyDriverIds.has(d.id));
    const availConductors = conductors.filter(c => !busyConductorIds.has(c.id));

    const dTotal = drivers.length;
    const cTotal = conductors.length;
    const dAvail = availDrivers.length;
    const cAvail = availConductors.length;

    let cls = 'dash-cal-cell';
    if (dAvail === 0 && cAvail === 0 && dTotal + cTotal > 0) cls += ' dash-cal-none';
    else if (dAvail < dTotal || cAvail < cTotal) cls += ' dash-cal-some';
    else if (dTotal + cTotal > 0) cls += ' dash-cal-all';
    if (isToday) cls += ' dash-cal-today';

    b += `<div class="${cls}" onclick="dashCalShowDay('${dateStr}')">
      <div class="dash-cal-daynum">${day}</div>
      <div class="dash-cal-info">${dAvail}/${dTotal} D</div>
      <div class="dash-cal-info">${cAvail}/${cTotal} C</div>
    </div>`;

    day++;
  }

  // Pad remaining cells to complete the week
  const totalCells = firstDay + daysInMonth;
  const remainder = totalCells % 7;
  if (remainder > 0) {
    for (let i = 0; i < 7 - remainder; i++) b += '<div class="dash-cal-cell dash-cal-empty"></div>';
  }

  b += '</div>';
  grid.innerHTML = h + b;
}

function dashCalShowDay(dateStr) {
  const modalDate = document.getElementById('dashCalModalDate');
  const modalBody = document.getElementById('dashCalModalBody');
  if (!modalDate || !modalBody) return;

  const d = new Date(dateStr + 'T00:00:00');
  modalDate.textContent = d.toLocaleDateString('en-PH', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  const drivers   = _dashCalEmployees.filter(e => e.position === 'DRIVER'   && e.isActive);
  const conductors = _dashCalEmployees.filter(e => e.position === 'CONDUCTOR' && e.isActive);
  const dayTrips = _dashCalTrips.filter(t => t.tripDate === dateStr);
  const busyDriverIds = new Set(dayTrips.map(t => t.driverId));
  const busyConductorIds = new Set(dayTrips.map(t => t.conductorId));

  const availDrivers = drivers.filter(d => !busyDriverIds.has(d.id));
  const availConductors = conductors.filter(c => !busyConductorIds.has(c.id));

  let html = '';
  html += `<div class="mb-2"><strong><i class="fas fa-user me-1"></i>Drivers (${availDrivers.length}/${drivers.length} available)</strong></div>`;
  if (!availDrivers.length) {
    html += '<div class="text-muted small mb-2">No drivers available</div>';
  } else {
    html += '<div class="mb-2" style="font-size:0.85rem">';
    availDrivers.forEach(d => { html += `<div style="white-space:nowrap">• ${d.fullName}</div>`; });
    html += '</div>';
  }

  html += `<div class="mb-1"><strong><i class="fas fa-user me-1"></i>Conductors (${availConductors.length}/${conductors.length} available)</strong></div>`;
  if (!availConductors.length) {
    html += '<div class="text-muted small">No conductors available</div>';
  } else {
    html += '<div style="font-size:0.85rem">';
    availConductors.forEach(c => { html += `<div style="white-space:nowrap">• ${c.fullName}</div>`; });
    html += '</div>';
  }

  modalBody.innerHTML = html;
  new bootstrap.Modal(document.getElementById('dashCalModal')).show();
}

// ══════════════════════════════════════════════════════════
// FINANCE MANAGEMENT
// ══════════════════════════════════════════════════════════
let _financePeriod = null;
let _financeTab    = 'daily';

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

function getBiMonthlyPeriod(offset = 0) {
  const now = new Date();
  let year  = now.getFullYear();
  let month = now.getMonth();  // 0-based
  // each month has 2 periods; offset moves by half-months
  let halfIndex = (year * 24 + month * 2 + (now.getDate() > 15 ? 1 : 0)) + offset;
  year  = Math.floor(halfIndex / 24);
  month = Math.floor((halfIndex % 24) / 2);
  const isSecond = (halfIndex % 2 === 1);
  const pad = n => String(n).padStart(2,'0');
  const lastDay = new Date(year, month + 1, 0).getDate();
  const from    = isSecond ? `${year}-${pad(month+1)}-16` : `${year}-${pad(month+1)}-01`;
  const to      = isSecond ? `${year}-${pad(month+1)}-${lastDay}` : `${year}-${pad(month+1)}-15`;
  const label   = isSecond
    ? `${MONTH_NAMES[month]} 16–${lastDay}, ${year}`
    : `${MONTH_NAMES[month]} 1–15, ${year}`;
  return { from, to, label, offset: halfIndex };
}

async function renderFinance() {
  if (!isAdmin()) { go('dashboard'); return; }
  _financePeriod = getBiMonthlyPeriod(_finOffset);

  shell('finance', `
    <div class="page-header d-flex justify-content-between align-items-center flex-wrap gap-2">
      <div>
        <h4><i class="fas fa-money-bill-wave me-2"></i>Finance Management</h4>
        <div class="subtitle">Bi-monthly payroll &amp; company treasury</div>
      </div>
      <div class="period-nav">
        <button onclick="shiftFinancePeriod(-1)" title="Previous period"><i class="fas fa-chevron-left"></i></button>
        <strong id="finPeriodLabel">${_financePeriod.label}</strong>
        <button onclick="shiftFinancePeriod(1)" title="Next period"><i class="fas fa-chevron-right"></i></button>
      </div>
    </div>

    <div class="content-card mb-3">
      <div style="border-bottom:1px solid #f0f0f0; padding:0 1rem;">
        <button class="finance-tab-btn ${_financeTab==='daily'?'active':''}" onclick="switchFinanceTab('daily')">
          <i class="fas fa-calendar-day me-1"></i>Daily Payroll
        </button>
        <button class="finance-tab-btn ${_financeTab==='bimonthly'?'active':''}" onclick="switchFinanceTab('bimonthly')">
          <i class="fas fa-calendar-alt me-1"></i>Bi-Monthly
        </button>
        <button class="finance-tab-btn ${_financeTab==='treasury'?'active':''}" onclick="switchFinanceTab('treasury')">
          <i class="fas fa-landmark me-1"></i>Company Treasury
        </button>
      </div>
      <div id="financeContent" class="p-3"></div>
    </div>
  `);

  if (_financeTab === 'daily')          loadDailyPayroll();
  else if (_financeTab === 'bimonthly') loadBiMonthlyPayroll();
  else loadFinanceTreasury();
}

let _finOffset = 0;
function shiftFinancePeriod(delta) {
  _finOffset += delta;
  _financePeriod = getBiMonthlyPeriod(_finOffset);
  const lbl = document.getElementById('finPeriodLabel');
  if (lbl) lbl.textContent = _financePeriod.label;
  if (_financeTab === 'daily')          loadDailyPayroll();
  else if (_financeTab === 'bimonthly') loadBiMonthlyPayroll();
  else loadFinanceTreasury();
}

function switchFinanceTab(tab) {
  _financeTab = tab;
  document.querySelectorAll('.finance-tab-btn').forEach(b => b.classList.remove('active'));
  // Mark the clicked button active
  document.querySelectorAll('.finance-tab-btn').forEach(b => {
    const t = b.getAttribute('onclick')?.match(/'(\w+)'/)?.[1];
    if (t === tab) b.classList.add('active');
  });
  if (tab === 'daily')          loadDailyPayroll();
  else if (tab === 'bimonthly') loadBiMonthlyPayroll();
  else loadFinanceTreasury();
}

// ── Shared payroll row builder ────────────────────────────
function _payrollBadge(r, hasRecords) {
  const status = hasRecords ? r.status : 'PREVIEW';
  if (status === 'PAID')
    return `<span class="payroll-paid">PAID<br><small>${r.paidAt ? new Date(r.paidAt).toLocaleDateString('en-PH') : ''}</small></span>`;
  if (status === 'PENDING')
    return `<span class="payroll-pending">PENDING</span>`;
  return `<span class="text-muted small">Preview</span>`;
}
function _payrollActionBtn(r, hasRecords) {
  return (hasRecords && r.status === 'PENDING')
    ? `<button class="btn btn-success btn-sm btn-icon" onclick="markPayrollPaid(${r.id})" title="Mark as Paid"><i class="fas fa-check"></i></button>`
    : '';
}
const _posBadge = p => `<span class="status-badge ${{DRIVER:'status-driver',CONDUCTOR:'status-conductor',HR:'status-hr',OPERATIONS:'status-operations',MECHANIC:'status-mechanic'}[p]||''}">${p}</span>`;

// ── Daily Payroll tab (Drivers & Conductors) ─────────────
let _dailyPayrollDate = 'all';
let _payrollPage = 1;

function changeDailyPayrollDate(val) {
  _dailyPayrollDate = val;
  loadDailyPayroll();
}

function changePayrollPage(p) {
  _payrollPage = p;
  loadDailyPayroll(false);
}

async function loadDailyPayroll(resetPage = true) {
  const { from, to } = _financePeriod;
  const el = document.getElementById('financeContent');
  if (!el) return;
  el.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Loading…</div>';
  try {
    const [allRec, allComp] = await Promise.all([
      api(`/payroll/records?from=${from}&to=${to}`),
      api(`/payroll/compute?from=${from}&to=${to}`)
    ]);
    const records  = allRec.filter(r => r.tripDate != null);
    const computed = allComp.filter(r => r.tripDate != null);
    const hasRecords = records.length > 0;
    const allRows  = hasRecords ? records : computed;

    // Distinct trip dates in this period, latest first
    const dates = [...new Set(allRows.map(r => r.tripDate))].sort((a, b) => b.localeCompare(a));
    if (_dailyPayrollDate !== 'all' && !dates.includes(_dailyPayrollDate)) _dailyPayrollDate = dates[0] || 'all';

    const rowData = _dailyPayrollDate === 'all'
      ? allRows
      : allRows.filter(r => r.tripDate === _dailyPayrollDate);

    if (resetPage) _payrollPage = 1;
    _payrollPage = clampPage(rowData.length, _payrollPage);
    const pageRows = paginate(rowData, _payrollPage);

    const totalNet = rowData.reduce((s, r) => s + Number(r.netPay || 0), 0);
    const paidCount = records.filter(r => r.status === 'PAID' && (_dailyPayrollDate === 'all' || r.tripDate === _dailyPayrollDate)).length;
    const recordsShown = records.filter(r => _dailyPayrollDate === 'all' || r.tripDate === _dailyPayrollDate).length;

    const dateOptions = dates.map(d => {
      const label = new Date(d + 'T00:00:00').toLocaleDateString('en-PH', {weekday:'short', month:'short', day:'numeric'});
      return `<option value="${d}" ${d === _dailyPayrollDate ? 'selected' : ''}>${label}</option>`;
    }).join('');

    el.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div class="d-flex align-items-center gap-2">
          <select class="form-select form-select-sm" style="max-width:170px" onchange="changeDailyPayrollDate(this.value)">
            <option value="all" ${_dailyPayrollDate === 'all' ? 'selected' : ''}>All Days</option>
            ${dateOptions}
          </select>
          <div class="text-muted small">
            ${hasRecords
              ? `<span class="badge bg-secondary">${recordsShown} records</span> &nbsp; <span class="badge bg-success">${paidCount} paid</span> &nbsp; <span class="badge bg-warning text-dark">${recordsShown - paidCount} pending</span>`
              : `<span class="badge bg-light text-dark border">Preview — not yet generated</span>`}
          </div>
        </div>
        <div class="d-flex gap-2 align-items-center">
          <span class="fw-bold">Total: ${peso(totalNet)}</span>
          <button class="btn ${hasRecords ? 'btn-outline-secondary' : 'btn-primary'} btn-sm" onclick="generatePayroll('${from}','${to}','daily')">
            <i class="fas fa-${hasRecords ? 'sync' : 'cogs'} me-1"></i>${hasRecords ? 'Add Missing' : 'Generate Daily Payroll'}
          </button>
        </div>
      </div>
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead><tr>
            <th>Date</th><th>Code</th><th>Employee</th><th>Position</th>
            <th>Base (₱1,225)</th><th>Bonus</th><th>Gross</th><th>Deductions</th><th>Net Pay</th>
            <th>Status</th><th></th>
          </tr></thead>
          <tbody>
            ${pageRows.map(r => {
              const dateStr = new Date(r.tripDate + 'T00:00:00').toLocaleDateString('en-PH', {weekday:'short', month:'short', day:'numeric'});
              return `<tr>
                <td class="text-nowrap small fw-semibold">${dateStr}</td>
                <td><code>${r.employeeCode}</code></td>
                <td>${r.fullName}</td>
                <td>${_posBadge(r.position)}</td>
                <td>${peso(r.basePay)}</td>
                <td class="text-success">${Number(r.bonusPay||0) > 0 ? '+'+peso(r.bonusPay) : '—'}</td>
                <td>${peso(r.grossPay)}</td>
                <td class="text-danger">${Number(r.deductions||0) > 0 ? '−'+peso(r.deductions) : '—'}</td>
                <td><strong>${peso(r.netPay)}</strong></td>
                <td>${_payrollBadge(r, hasRecords)}</td>
                <td>${_payrollActionBtn(r, hasRecords)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div id="payrollPager"></div>`;
    renderPager('payrollPager', rowData.length, _payrollPage, 'changePayrollPage');
  } catch {
    el.innerHTML = '<div class="alert alert-danger">Failed to load daily payroll.</div>';
  }
}

// ── Bi-Monthly Payroll tab (HR / Operations / Mechanic) ──
async function loadBiMonthlyPayroll() {
  const { from, to } = _financePeriod;
  const el = document.getElementById('financeContent');
  if (!el) return;
  el.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Loading…</div>';
  try {
    const [allRec, allComp] = await Promise.all([
      api(`/payroll/records?from=${from}&to=${to}`),
      api(`/payroll/compute?from=${from}&to=${to}`)
    ]);
    const records  = allRec.filter(r => r.tripDate == null);
    const computed = allComp.filter(r => r.tripDate == null);
    const hasRecords = records.length > 0;
    const rowData  = hasRecords ? records : computed;
    const totalNet = rowData.reduce((s, r) => s + Number(r.netPay || 0), 0);
    const paidCount = records.filter(r => r.status === 'PAID').length;

    el.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div class="text-muted small">
          ${hasRecords
            ? `<span class="badge bg-secondary">${records.length} records</span> &nbsp; <span class="badge bg-success">${paidCount} paid</span> &nbsp; <span class="badge bg-warning text-dark">${records.length - paidCount} pending</span>`
            : `<span class="badge bg-light text-dark border">Preview — not yet generated</span>`}
        </div>
        <div class="d-flex gap-2 align-items-center">
          <span class="fw-bold">Total: ${peso(totalNet)}</span>
          <button class="btn ${hasRecords ? 'btn-outline-secondary' : 'btn-primary'} btn-sm" onclick="generatePayroll('${from}','${to}','bimonthly')">
            <i class="fas fa-${hasRecords ? 'sync' : 'cogs'} me-1"></i>${hasRecords ? 'Add Missing' : 'Generate Bi-Monthly Payroll'}
          </button>
        </div>
      </div>
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead><tr>
            <th>Code</th><th>Employee</th><th>Position</th>
            <th>Gross Pay</th><th>Net Pay</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            ${rowData.map(r => `<tr>
              <td><code>${r.employeeCode}</code></td>
              <td>${r.fullName}</td>
              <td>${_posBadge(r.position)}</td>
              <td>${peso(r.grossPay)}</td>
              <td><strong>${peso(r.netPay)}</strong></td>
              <td>${_payrollBadge(r, hasRecords)}</td>
              <td>${_payrollActionBtn(r, hasRecords)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch {
    el.innerHTML = '<div class="alert alert-danger">Failed to load bi-monthly payroll.</div>';
  }
}

async function generatePayroll(from, to, type) {
  const ok = await confirmModal(
    'Generate Payroll',
    `Generate payroll records for the period ${from} to ${to}? Existing records for this period may be overwritten.`,
    'Generate',
    'btn-primary'
  );
  if (!ok) return;
  try {
    const r = await api('/payroll/generate', 'POST', { from, to });
    toast(`${r.generated} record(s) generated`);
    if (type === 'bimonthly') loadBiMonthlyPayroll();
    else loadDailyPayroll(false);
  } catch {}
}

async function markPayrollPaid(id) {
  const ok = await confirmModal(
    'Mark as Paid',
    'Mark this payroll record as paid? This action cannot be undone.',
    'Mark as Paid',
    'btn-success'
  );
  if (!ok) return;
  try {
    await api(`/payroll/${id}/pay`, 'PATCH');
    toast('Marked as paid');
    if (_financeTab === 'bimonthly') loadBiMonthlyPayroll();
    else loadDailyPayroll(false);
  } catch {}
}

async function loadFinanceTreasury() {
  const { from, to } = _financePeriod;
  const el = document.getElementById('financeContent');
  if (!el) return;
  el.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Loading treasury…</div>';

  try {
    const s = await api(`/payroll/summary?from=${from}&to=${to}`);

    const operWages    = Number(s.totalOperatorWages    || 0);
    const fixedPayroll = Number(s.fixedStaffPayroll     || 0);
    const totalPayroll = operWages + fixedPayroll;
    const opExps       = Number(s.totalExpenses         || 0) - operWages;  // expenses minus embedded wages
    const companyFinal = Number(s.companyFinal          || 0);

    el.innerHTML = `
      <div class="row g-3 mb-3">
        <div class="col-6 col-md-3"><div class="stat-card blue"><div class="stat-label">Gross Income</div><div class="stat-value">${peso(s.totalGrossIncome)}</div></div></div>
        <div class="col-6 col-md-3"><div class="stat-card red"><div class="stat-label">Total Payroll Out</div><div class="stat-value">${peso(totalPayroll)}</div></div></div>
        <div class="col-6 col-md-3"><div class="stat-card purple"><div class="stat-label">Operating Expenses</div><div class="stat-value">${peso(s.totalExpenses)}</div></div></div>
        <div class="col-6 col-md-3"><div class="stat-card green"><div class="stat-label">Company Keeps</div><div class="stat-value">${peso(companyFinal)}</div></div></div>
      </div>
      <div class="content-card p-3">
        <div class="dash-section-label mb-2">Money Flow Breakdown</div>
        <div class="treasury-row"><span>Gross Income (all trips)</span><span class="text-success fw-semibold">${peso(s.totalGrossIncome)}</span></div>
        <div class="treasury-row"><span class="ms-3 text-muted">− Driver &amp; Conductor Wages</span><span class="text-danger">−${peso(s.totalOperatorWages)}</span></div>
        <div class="treasury-row"><span class="ms-3 text-muted">− Bond Deductions (retained)</span><span class="text-muted">−${peso(s.totalBondsRetained)}</span></div>
        <div class="treasury-row"><span class="ms-3 text-muted">− Commission</span><span class="text-muted">−${peso(s.totalCommission)}</span></div>
        <div class="treasury-row"><span>Net Income after bonds</span><span class="fw-semibold">${peso(s.totalNetIncome)}</span></div>
        <div class="treasury-row"><span class="ms-3 text-muted">− Operating Expenses (fuel, wash, damages…)</span><span class="text-danger">−${peso(s.totalExpenses)}</span></div>
        <div class="treasury-row"><span>Net Profit (from trips)</span><span class="fw-semibold">${peso(s.netProfit)}</span></div>
        <div class="treasury-row"><span class="ms-3 text-muted">− Fixed Staff Payroll (HR/Ops/Mechanic)</span><span class="text-danger">−${peso(s.fixedStaffPayroll)}</span></div>
        <div class="treasury-row" style="margin-top:0.5rem;padding-top:0.5rem;border-top:2px solid #e0e0e0">
          <span>Company Final (this period)</span>
          <span class="fw-bold fs-5 ${companyFinal >= 0 ? 'text-success' : 'text-danger'}">${peso(companyFinal)}</span>
        </div>
      </div>`;
  } catch {
    el.innerHTML = '<div class="alert alert-danger">Failed to load treasury data.</div>';
  }
}

// ══════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  if (getToken()) go('dashboard');
  else renderLogin();
});
