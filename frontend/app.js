/* ============================================================
   Metrolink FOMS — Single-Page Application
   API base: http://localhost:8080/metrolink-backend/api
   ============================================================ */

const API = 'http://localhost:8080/metrolink-backend/api';
let currentPage = 'trips';

// ── Auth helpers ───────────────────────────────────────────
const getToken  = () => localStorage.getItem('ml_token');
const getUser   = () => JSON.parse(localStorage.getItem('ml_user') || 'null');
const isAdmin   = () => getUser()?.role === 'ADMIN';

function saveSession(data) {
  localStorage.setItem('ml_token', data.token);
  localStorage.setItem('ml_user', JSON.stringify(data));
}
function clearSession() {
  localStorage.removeItem('ml_token');
  localStorage.removeItem('ml_user');
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

  if (res.status === 401) { clearSession(); renderLogin(); throw new Error('Unauthorized'); }

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

// ── Row count helper ───────────────────────────────────────
function setRowCount(containerId, count, label = 'record') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.textContent = count === 0 ? 'No records' : `${count} ${label}${count !== 1 ? 's' : ''}`;
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
    { id: 'dashboard', icon: 'fa-th-large',     label: 'Dashboard' },
    { id: 'trips',     icon: 'fa-route',        label: 'Trip Management' },
    { id: 'employees', icon: 'fa-users',         label: 'Employees' },
    { id: 'buses',     icon: 'fa-bus',           label: 'Buses' },
    { id: 'reports',   icon: 'fa-chart-bar',     label: 'Reports' },
    { id: 'help',      icon: 'fa-circle-question', label: 'Help' },
  ];
  if (isAdmin()) {
    nav.push({ id: 'finance', icon: 'fa-money-bill-wave',  label: 'Finance' });
    nav.push({ id: 'users',   icon: 'fa-user-cog',         label: 'Staff Accounts' });
    nav.push({ id: 'audit',   icon: 'fa-clipboard-list',   label: 'Audit Log' });
    nav.push({ id: 'backup',  icon: 'fa-database',         label: 'Backup' });
  }

  const navHtml = nav.map(n => `
    <div class="nav-link-item ${activePage === n.id ? 'active' : ''}" onclick="go('${n.id}')">
      <i class="fas ${n.icon}"></i> <span>${n.label}</span>
    </div>`).join('');

  document.getElementById('app').innerHTML = `
    <div class="app-layout">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="brand-icon"><i class="fas fa-bus-alt"></i></div>
          <h6>METROLINK FOMS</h6>
          <small>Baclaran Bus Corp.</small>
          <div class="brand-status"><span class="status-dot"></span>System Online</div>
        </div>
        <nav class="sidebar-nav">${navHtml}</nav>
        <div class="sidebar-footer">
          <div class="user-name">${user?.fullName || user?.username}</div>
          <div class="user-role">${user?.role}</div>
          <button class="logout-btn" onclick="logout()"><i class="fas fa-sign-out-alt me-1"></i>Logout</button>
        </div>
      </aside>
      <main class="main-content">${content}</main>
    </div>`;
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
    go('trips');
  } catch (err) {
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
        <input type="text" id="tripSearch" class="form-control form-control-sm" style="max-width:220px"
          placeholder="Search bus, driver…" oninput="searchTrips(this.value)">
        <input type="date" id="tripDateFilter" class="form-control form-control-sm" style="max-width:160px"
          onchange="filterByDate(this.value)">
        <button class="btn btn-outline-secondary btn-sm" onclick="renderTrips()" title="Refresh">
          <i class="fas fa-sync-alt"></i>
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
    </div>
    ${getTripModal()}${getIncomeExpModal()}`);

  try {
    [tripsList, tripBuses, tripDrivers, tripConductors] = await Promise.all([
      api('/trips'),
      api('/buses'),
      api('/employees'),
      api('/employees')
    ]);
    tripDrivers    = tripDrivers.filter(e => e.position === 'DRIVER' && e.isActive);
    tripConductors = tripConductors.filter(e => e.position === 'CONDUCTOR' && e.isActive);
    renderTripRows(tripsList);
  } catch { renderTripRows([]); }
}

function renderTripRows(rows) {
  const tbody = document.getElementById('tripBody');
  if (!tbody) return;
  setRowCount('tripCount', rows.length, 'trip');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="table-empty"><i class="fas fa-route"></i>No trips found</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(t => `
    <tr>
      <td>${t.tripDate}</td>
      <td><strong>${dash(t.busNumber)}</strong></td>
      <td>${dash(t.driverName)}</td>
      <td>${dash(t.conductorName)}</td>
      <td>${t.dispatchTime || '—'}</td>
      <td>${t.arrivalTime || '—'}</td>
      <td class="text-center">${t.tripCount}</td>
      <td>${t.isModified ? '<span class="status-badge status-modified">Modified</span>' : '<span class="status-badge status-active">Original</span>'}</td>
      <td>
        <button class="btn btn-outline-primary btn-icon me-1" onclick="openIncomeExp(${t.id},'${t.busNumber}','${t.tripDate}')" title="Income & Expenses">
          <i class="fas fa-dollar-sign"></i>
        </button>
        ${isAdmin() ? `<button class="btn btn-outline-secondary btn-icon" onclick="openEditTrip(${t.id})" title="Edit Trip"><i class="fas fa-edit"></i></button>` : ''}
      </td>
    </tr>`).join('');
}

async function refreshTripTable() {
  const search = document.getElementById('tripSearch')?.value.trim() || '';
  const date = document.getElementById('tripDateFilter')?.value || '';
  tripsList = await api('/trips');

  if (search) {
    renderTripRows(await api(`/trips/search?q=${encodeURIComponent(search)}`));
  } else if (date) {
    renderTripRows(await api(`/trips/date?date=${date}`));
  } else {
    renderTripRows(tripsList);
  }
}

function searchTrips(q) {
  if (!q.trim()) { renderTripRows(tripsList); return; }
  api(`/trips/search?q=${encodeURIComponent(q)}`).then(renderTripRows).catch(() => {});
}

function filterByDate(d) {
  if (!d) { renderTripRows(tripsList); return; }
  api(`/trips/date?date=${d}`).then(renderTripRows).catch(() => {});
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
                <label class="form-label">Trip Count *</label>
                <input type="number" id="tCount" class="form-control" min="1" max="10" value="4" required>
              </div>
              <div class="col-md-6">
                <label class="form-label">Driver *</label>
                <select id="tDriver" class="form-select" required></select>
              </div>
              <div class="col-md-6">
                <label class="form-label">Conductor *</label>
                <select id="tConductor" class="form-select" required></select>
              </div>
              <div class="col-md-6">
                <label class="form-label">Dispatch Time *</label>
                <input type="time" id="tDispatch" class="form-control" required>
              </div>
              <div class="col-md-6">
                <label class="form-label">Arrival Time</label>
                <input type="time" id="tArrival" class="form-control">
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
  ['tDate','tDispatch','tArrival','tRemarks'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = el.type === 'number' ? '0' : '';
  });
  document.getElementById('tDate').value = new Date().toISOString().split('T')[0];
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
  document.getElementById('tCount').value = trip.tripCount;
  document.getElementById('tDispatch').value = (trip.dispatchTime || '').substring(0, 5);
  document.getElementById('tArrival').value  = (trip.arrivalTime  || '').substring(0, 5);
  document.getElementById('tRemarks').value = trip.remarks || '';
  populateTripDropdowns(trip.busId, trip.driverId, trip.conductorId);
  await refreshAvailableStaff();
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
    const { drivers, conductors } = await api(`/trips/available-staff?date=${date}&excludeTripId=${excludeId}`);
    const curDriver    = document.getElementById('tDriver').value;
    const curConductor = document.getElementById('tConductor').value;
    document.getElementById('tDriver').innerHTML =
      drivers.length
        ? drivers.map(d => `<option value="${d.id}" ${d.id == curDriver ? 'selected' : ''}>${d.fullName}</option>`).join('')
        : '<option value="" disabled>No drivers available for this date</option>';
    document.getElementById('tConductor').innerHTML =
      conductors.length
        ? conductors.map(c => `<option value="${c.id}" ${c.id == curConductor ? 'selected' : ''}>${c.fullName}</option>`).join('')
        : '<option value="" disabled>No conductors available for this date</option>';
  } catch {}
}

async function saveTripDetails() {
  const body = {
    tripDate:     document.getElementById('tDate').value,
    busId:        +document.getElementById('tBus').value,
    driverId:     +document.getElementById('tDriver').value,
    conductorId:  +document.getElementById('tConductor').value,
    dispatchTime: document.getElementById('tDispatch').value + ':00',
    arrivalTime:  (document.getElementById('tArrival').value || '00:00') + ':00',
    tripCount:    +document.getElementById('tCount').value,
    remarks:      document.getElementById('tRemarks').value
  };

  if (!body.tripDate || !body.busId || !body.driverId || !body.conductorId || !body.dispatchTime) {
    toast('Please fill all required fields', 'warning'); return false;
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
    <div class="modal-dialog modal-lg">
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
        </select>
        <span class="row-count-badge ms-auto" id="empCount"></span>
      </div>
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead><tr><th>Code</th><th>Name</th><th>Birthdate</th><th>Address</th><th>Position</th><th>Daily Rate</th><th>Bi-Monthly Rate</th><th>Status</th>
            ${isAdmin() ? '<th>Actions</th>' : ''}</tr></thead>
          <tbody id="empBody"><tr><td colspan="6" class="table-empty">
            <div class="spinner-border spinner-border-sm text-muted"></div></td></tr></tbody>
        </table>
      </div>
    </div>
    ${getEmployeeModal()}`);

  try {
    const emps = await api('/employees');
    window._emps = emps;
    renderEmployeeRows(emps);
  } catch { renderEmployeeRows([]); }
}

function renderEmployeeRows(rows) {
  const tbody = document.getElementById('empBody');
  if (!tbody) return;
  setRowCount('empCount', rows.length, 'employee');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty"><i class="fas fa-users"></i>No employees found</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(e => `
    <tr>
      <td><code>${e.employeeCode}</code></td>
      <td><strong>${e.fullName}</strong></td>
      <td>${e.birthdate || '—'}</td>
      <td>${dash(e.address)}</td>
      <td><span class="status-badge ${{DRIVER:'status-driver',CONDUCTOR:'status-conductor',HR:'status-hr',OPERATIONS:'status-operations',MECHANIC:'status-mechanic'}[e.position]||'status-inactive'}">${e.position}</span></td>
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
}

function filterEmployeeRows(q) {
  const search = (q || document.getElementById('empSearch')?.value || '').toLowerCase();
  const pos    = document.getElementById('empPosFilter')?.value || '';
  const rows   = (window._emps || []).filter(e =>
    (!search || e.fullName.toLowerCase().includes(search) || e.employeeCode.toLowerCase().includes(search)) &&
    (!pos || e.position === pos));
  renderEmployeeRows(rows);
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
}

function openAddEmployee() {
  document.getElementById('empModalTitle').textContent = 'Add Employee';
  document.getElementById('empId').value = '';
  ['empCode','empName','empBirthdate','empAddress'].forEach(id => document.getElementById(id).value = '');
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
    biMonthlyRate: isDaily ? null : rateVal
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
async function renderBuses() {
  shell('buses', `
    <div class="page-header">
      <div><h4><i class="fas fa-bus me-2"></i>Bus Management</h4>
        <div class="subtitle">Manage the bus fleet</div></div>
      ${isAdmin() ? `<button class="btn btn-primary btn-sm" onclick="openAddBus()"><i class="fas fa-plus me-1"></i>Add Bus</button>` : ''}
    </div>
    <div class="content-card">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead><tr><th>Bus Number</th><th>Plate No.</th><th>Model</th><th>Status</th>
            ${isAdmin() ? '<th>Actions</th>' : ''}</tr></thead>
          <tbody id="busBody"><tr><td colspan="5" class="table-empty">
            <div class="spinner-border spinner-border-sm text-muted"></div></td></tr></tbody>
        </table>
      </div>
    </div>
    ${getBusModal()}`);

  try {
    const buses = await api('/buses');
    window._buses = buses;
    renderBusRows(buses);
  } catch { renderBusRows([]); }
}

function renderBusRows(rows) {
  const tbody = document.getElementById('busBody');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty"><i class="fas fa-bus"></i>No buses found</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(b => `
    <tr>
      <td><strong>${b.busNumber}</strong></td>
      <td>${b.plateNo}</td>
      <td>${dash(b.model)}</td>
      <td><span class="status-badge ${{ACTIVE:'status-active',INACTIVE:'status-inactive',MAINTENANCE:'status-maintenance'}[b.status]||'status-inactive'}">${{ACTIVE:'Active',INACTIVE:'Inactive',MAINTENANCE:'Under Maintenance'}[b.status]||b.status}</span></td>
      ${isAdmin() ? `<td class="d-flex gap-1 flex-wrap">
        <button class="btn btn-outline-primary btn-icon" onclick="openEditBus(${b.id})" title="Edit"><i class="fas fa-edit"></i></button>
        ${b.status !== 'ACTIVE'      ? `<button class="btn btn-outline-success btn-icon" onclick="setBusStatus(${b.id},'ACTIVE')" title="Activate"><i class="fas fa-check"></i></button>` : ''}
        ${b.status !== 'MAINTENANCE' ? `<button class="btn btn-outline-warning btn-icon" onclick="setBusStatus(${b.id},'MAINTENANCE')" title="Set Maintenance"><i class="fas fa-wrench"></i></button>` : ''}
        ${b.status !== 'INACTIVE'    ? `<button class="btn btn-outline-danger btn-icon" onclick="setBusStatus(${b.id},'INACTIVE')" title="Deactivate"><i class="fas fa-ban"></i></button>` : ''}
      </td>` : ''}
    </tr>`).join('');
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
  ['busNum','busPlate','busModel'].forEach(id => document.getElementById(id).value = '');
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
  new bootstrap.Modal(document.getElementById('busModal')).show();
}

async function saveBus() {
  const id = document.getElementById('busId').value;
  const body = {
    busNumber: document.getElementById('busNum').value.trim(),
    plateNo:   document.getElementById('busPlate').value.trim(),
    model:     document.getElementById('busModel').value.trim()
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
      </div>
    </div>
    <div id="reportContent"></div>`);

  // Auto-load summary
  loadReport('summary');
}

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
      const rows = await api(`/reports/trips?from=${from}&to=${to}`);
      cont.innerHTML = `
        <div class="content-card">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead><tr><th>Date</th><th>Bus</th><th>Driver</th><th>Conductor</th>
                <th>Trips</th><th>Gross</th><th>Net Income</th><th>Expenses</th><th>Net Profit</th><th>Modified</th></tr></thead>
              <tbody>${!rows.length ? `<tr><td colspan="10" class="table-empty">No data for selected range</td></tr>` :
                rows.map(r => `<tr>
                  <td>${r.tripDate}</td><td>${r.busNumber}</td><td>${r.driverName}</td><td>${r.conductorName}</td>
                  <td class="text-center">${r.tripCount}</td>
                  <td>${peso(r.grossIncome)}</td><td>${peso(r.netIncome)}</td>
                  <td>${peso(r.totalExpenses)}</td>
                  <td class="${(r.netProfit||0)<0?'text-danger fw-bold':''}">${peso(r.netProfit)}</td>
                  <td>${r.isModified?'<span class="status-badge status-modified">Yes</span>':'—'}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
    } else if (type === 'low-income') {
      const rows = await api(`/reports/low-income?from=${from}&to=${to}`);
      cont.innerHTML = `
        <div class="alert alert-warning py-2 px-3 mb-2" style="font-size:0.8rem">
          <i class="fas fa-exclamation-triangle me-1"></i>Showing trips where Gross Income < ₱13,000 (below quota)
        </div>
        <div class="content-card">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead><tr><th>Date</th><th>Bus</th><th>Driver</th><th>Conductor</th><th>Gross Income</th><th>Net Income</th></tr></thead>
              <tbody>${!rows.length ? `<tr><td colspan="6" class="table-empty"><i class="fas fa-check-circle text-success"></i>No low-income trips!</td></tr>` :
                rows.map(r => `<tr>
                  <td>${r.tripDate}</td><td>${r.busNumber}</td><td>${r.driverName}</td><td>${r.conductorName}</td>
                  <td class="text-danger fw-bold">${peso(r.grossIncome)}</td><td>${peso(r.netIncome)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
    } else if (type === 'changelog') {
      const rows = await api(`/reports/changelog?from=${from}&to=${to}`);
      cont.innerHTML = `
        <div class="content-card">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead><tr><th>Date</th><th>Trip ID</th><th>Changed By</th><th>Type</th><th>Changed At</th></tr></thead>
              <tbody>${!rows.length ? `<tr><td colspan="5" class="table-empty">No edits in this period</td></tr>` :
                rows.map(r => `<tr>
                  <td>${r.tripDate}</td><td>#${r.tripId}</td><td>${r.changedByName}</td>
                  <td><span class="status-badge status-modified">${r.changeType}</span></td>
                  <td>${r.changedAt ? new Date(r.changedAt).toLocaleString('en-PH') : '—'}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
    }
  } catch {
    cont.innerHTML = '<div class="alert alert-danger">Failed to load report.</div>';
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
      'Click "Generate & Download Backup" to run a database dump and download a .sql file containing all current data.',
      'Store the downloaded file somewhere safe — it can be used to restore the system in case of data loss.',
    ],
  },
];

function helpAccordionItem(f, index) {
  const collapseId = `help-collapse-${f.id}`;
  const headingId  = `help-heading-${f.id}`;
  return `
    <div class="accordion-item">
      <h2 class="accordion-header" id="${headingId}">
        <button class="accordion-button ${index === 0 ? '' : 'collapsed'}" type="button"
          data-bs-toggle="collapse" data-bs-target="#${collapseId}"
          aria-expanded="${index === 0 ? 'true' : 'false'}" aria-controls="${collapseId}">
          <i class="fas ${f.icon} me-2 text-primary"></i><strong>${f.title}</strong>
          ${f.roles.length === 1 ? '<span class="status-badge status-admin ms-2">Admin only</span>' : ''}
        </button>
      </h2>
      <div id="${collapseId}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}"
        aria-labelledby="${headingId}" data-bs-parent="#helpAccordion">
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
        ${items.map((f, i) => helpAccordionItem(f, i)).join('')}
      </div>
    </div>`);
}

// ══════════════════════════════════════════════════════════
// USERS (Admin only)
// ══════════════════════════════════════════════════════════
async function renderUsers() {
  if (!isAdmin()) { go('trips'); return; }
  shell('users', `
    <div class="page-header">
      <div><h4><i class="fas fa-user-cog me-2"></i>Staff Accounts</h4>
        <div class="subtitle">Manage system user accounts</div></div>
      <button class="btn btn-primary btn-sm" onclick="openAddUser()"><i class="fas fa-plus me-1"></i>Register Staff</button>
    </div>
    <div class="content-card">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead><tr><th>Username</th><th>Full Name</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="userBody"><tr><td colspan="5" class="table-empty">
            <div class="spinner-border spinner-border-sm text-muted"></div></td></tr></tbody>
        </table>
      </div>
    </div>
    ${getUserModal()}`);

  try {
    const users = await api('/users');
    window._users = users;
    renderUserRows(users);
  } catch { renderUserRows([]); }
}

function renderUserRows(rows) {
  const tbody = document.getElementById('userBody');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty"><i class="fas fa-user-cog"></i>No users found</td></tr>`;
    return;
  }
  const me = getUser();
  tbody.innerHTML = rows.map(u => `
    <tr>
      <td><code>${u.username}</code></td>
      <td><strong>${u.fullName}</strong></td>
      <td><span class="status-badge ${u.role === 'ADMIN' ? 'status-admin' : 'status-staff'}">${u.role}</span></td>
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
            <div class="col-md-6">
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
  ['uUsername','uFullName','uPassword','uBirthdate','uEmail','uAddress'].forEach(id => document.getElementById(id).value = '');
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
  document.getElementById('uEmail').value = u.email || '';
  document.getElementById('uAddress').value = u.address || '';
  document.getElementById('uRole').value = u.role;
  document.getElementById('uPassRow').style.display = 'none';
  new bootstrap.Modal(document.getElementById('userModal')).show();
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
  if (!isAdmin()) { go('trips'); return; }
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
      <button class="btn btn-primary" onclick="doBackup(this)">
        <i class="fas fa-download me-2"></i>Generate &amp; Download Backup
      </button>
      <div id="backupStatus" class="mt-3"></div>
    </div>`);
}

async function doBackup(btn) {
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generating…';
  const status = document.getElementById('backupStatus');
  try {
    const token = getToken();
    const res = await fetch(API + '/backup', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    if (!res.ok) { throw new Error('Backup failed'); }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `metrolink_backup_${new Date().toISOString().slice(0,10)}.sql`;
    a.click();
    URL.revokeObjectURL(url);
    status.innerHTML = '<div class="alert alert-success py-2">Backup downloaded successfully!</div>';
    toast('Backup complete!');
  } catch {
    status.innerHTML = '<div class="alert alert-danger py-2">Backup failed. Check server logs.</div>';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-download me-2"></i>Generate &amp; Download Backup';
  }
}

// ══════════════════════════════════════════════════════════
// AUDIT LOG (Admin only)
// ══════════════════════════════════════════════════════════
async function renderAudit() {
  if (!isAdmin()) { go('trips'); return; }
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

async function loadAuditLog() {
  const from = document.getElementById('auditFrom').value;
  const to   = document.getElementById('auditTo').value;
  const wrap = document.getElementById('auditTableWrap');
  wrap.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Loading…</div>';
  try {
    const rows = await api(`/audit?from=${from}&to=${to}`);
    if (!rows.length) {
      wrap.innerHTML = '<div class="alert alert-info">No audit entries found for this period.</div>';
      return;
    }
    const actionBadge = a => {
      if (a.startsWith('LOGIN'))          return `<span class="badge bg-primary">${a}</span>`;
      if (a.startsWith('CREATE'))         return `<span class="badge bg-success">${a}</span>`;
      if (a.startsWith('UPDATE'))         return `<span class="badge bg-warning text-dark">${a}</span>`;
      return                                     `<span class="badge bg-danger">${a}</span>`;
    };
    wrap.innerHTML = `
      <div class="table-responsive">
        <table class="table table-hover table-sm">
          <thead><tr>
            <th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>ID</th><th>Details</th>
          </tr></thead>
          <tbody>
            ${rows.map(r => `<tr>
              <td class="text-nowrap">${r.loggedAt ? new Date(r.loggedAt).toLocaleString('en-PH') : '—'}</td>
              <td>${r.username}</td>
              <td>${actionBadge(r.action)}</td>
              <td>${r.entity || '—'}</td>
              <td>${r.entityId != null ? r.entityId : '—'}</td>
              <td>${r.details || '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch {
    wrap.innerHTML = '<div class="alert alert-danger">Failed to load audit log.</div>';
  }
}

// ══════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════
let _dashChart = null, _dashChart2 = null, _dashChart3 = null;

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
        <div class="content-card p-3" style="max-height:300px;overflow-y:auto">
          <div class="dash-section-label">Today's Trips</div>
          <div id="dashTodayTrips"><div class="text-muted small">Loading…</div></div>
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
      <div class="col-md-6">
        <div class="content-card p-3">
          <div class="dash-section-label">Payroll Cost Breakdown (MTD)</div>
          <div class="dash-chart-wrap" id="dashChart3Wrap"><canvas id="dashChart3"></canvas></div>
        </div>
      </div>
    </div>

    ${isAdmin() ? `
    <div class="content-card p-3 mb-3">
      <div class="dash-section-label">Recent Activity</div>
      <div id="dashActivity"><div class="text-muted small">Loading…</div></div>
    </div>` : ''}
  `);

  [_dashChart, _dashChart2, _dashChart3].forEach(c => { if (c) c.destroy(); });
  _dashChart = _dashChart2 = _dashChart3 = null;

  try {
    const [summary, todayTrips, tripReport14, tripReport28, payrollSummary, auditLog] = await Promise.all([
      api(`/reports/summary?from=${mtdStart}&to=${today}`),
      api(`/trips/date?date=${today}`),
      api(`/reports/trips?from=${fourteenAgo}&to=${today}`),
      api(`/reports/trips?from=${fourWeekAgo}&to=${today}`),
      isAdmin() ? api(`/payroll/summary?from=${mtdStart}&to=${today}`) : Promise.resolve(null),
      isAdmin() ? api(`/audit?from=${sevenAgo}&to=${today}`) : Promise.resolve([])
    ]);

    // ── Stat cards ──
    document.getElementById('dGross').textContent  = peso(summary.totalGrossIncome);
    document.getElementById('dTrips').textContent  = summary.totalTrips ?? '0';
    document.getElementById('dExp').textContent    = peso(summary.totalExpenses);
    document.getElementById('dProfit').textContent = peso(summary.totalNetProfit);

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
  if (!isAdmin()) { go('trips'); return; }
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
async function loadDailyPayroll() {
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
            ${rowData.map(r => {
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
      </div>`;
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
    else loadDailyPayroll();
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
    else loadDailyPayroll();
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
