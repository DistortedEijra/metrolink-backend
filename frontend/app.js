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
  const el  = document.getElementById('toast');
  const txt = document.getElementById('toastMsg');
  el.className = `toast align-items-center text-white border-0 bg-${type}`;
  txt.textContent = msg;
  bootstrap.Toast.getOrCreateInstance(el, { delay: 3500 }).show();
}

// ── Format helpers ─────────────────────────────────────────
const peso = v => v == null ? '—' : '₱' + Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const dash = v => v == null || v === '' ? '—' : v;

// ── Navigate ───────────────────────────────────────────────
function go(page) {
  if (!getToken() && page !== 'login') { renderLogin(); return; }
  if (getToken() && page === 'login')  { go('dashboard'); return; }
  currentPage = page;
  const map = { login: renderLogin, dashboard: renderDashboard, trips: renderTrips, employees: renderEmployees,
                buses: renderBuses, reports: renderReports, finance: renderFinance, users: renderUsers,
                backup: renderBackup, audit: renderAudit };
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

function logout() { clearSession(); renderLogin(); }

// ══════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════
function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div class="login-wrapper">
      <div class="login-card">
        <div class="login-logo">
          <div class="logo-circle"><i class="fas fa-bus-alt"></i></div>
          <h5>Metrolink FOMS</h5>
          <small>Financial & Operational Management System</small>
        </div>
        <form onsubmit="doLogin(event)">
          <div class="mb-3">
            <label class="form-label">Username</label>
            <div class="input-group">
              <span class="input-group-text"><i class="fas fa-user text-muted"></i></span>
              <input type="text" id="loginUser" class="form-control" placeholder="Enter username" required autofocus>
            </div>
          </div>
          <div class="mb-4">
            <label class="form-label">Password</label>
            <div class="input-group">
              <span class="input-group-text"><i class="fas fa-lock text-muted"></i></span>
              <input type="password" id="loginPass" class="form-control" placeholder="Enter password" required>
            </div>
          </div>
          <button type="submit" class="btn btn-primary w-100 fw-semibold" id="loginBtn">
            <i class="fas fa-sign-in-alt me-2"></i>Login
          </button>
        </form>
      </div>
    </div>`;
}

async function doLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging in…';
  try {
    const data = await api('/auth/login', 'POST', {
      username: document.getElementById('loginUser').value.trim(),
      password: document.getElementById('loginPass').value
    });
    saveSession(data);
    go('trips');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Login'; }
  }
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
        <button class="btn btn-outline-secondary btn-sm" onclick="renderTrips()">
          <i class="fas fa-sync-alt"></i>
        </button>
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
          <ul class="nav trip-tabs" id="tripTabs">
            <li class="nav-item"><button class="nav-link active" data-tab="0">1. Trip Details</button></li>
            <li class="nav-item"><button class="nav-link" data-tab="1">2. Income</button></li>
            <li class="nav-item"><button class="nav-link" data-tab="2">3. Expenses</button></li>
          </ul>
          <div id="tripTab0">
            <input type="hidden" id="tripId">
            <div class="row g-3">
              <div class="col-md-4">
                <label class="form-label">Trip Date *</label>
                <input type="date" id="tDate" class="form-control" required>
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
          <div id="tripTab1" style="display:none">
            <div class="row g-3">
              <div class="col-md-4">
                <label class="form-label">Gross Income *</label>
                <div class="input-group">
                  <span class="input-group-text">₱</span>
                  <input type="number" id="iGross" class="form-control" min="0" step="0.01" placeholder="0.00" oninput="calcNet()">
                </div>
              </div>
              <div class="col-md-4">
                <label class="form-label">Driver Income</label>
                <div class="input-group">
                  <span class="input-group-text">₱</span>
                  <input type="number" id="iDriverIncome" class="form-control" min="0" step="0.01" value="0" oninput="calcNet()">
                </div>
              </div>
              <div class="col-md-4">
                <label class="form-label">Conductor Income</label>
                <div class="input-group">
                  <span class="input-group-text">₱</span>
                  <input type="number" id="iConductorIncome" class="form-control" min="0" step="0.01" value="0" oninput="calcNet()">
                </div>
              </div>
              <div class="col-md-4">
                <label class="form-label">Driver Bond</label>
                <div class="input-group">
                  <span class="input-group-text">₱</span>
                  <input type="number" id="iDriverBond" class="form-control" min="0" step="0.01" value="0" oninput="calcNet()">
                </div>
              </div>
              <div class="col-md-4">
                <label class="form-label">Conductor Bond</label>
                <div class="input-group">
                  <span class="input-group-text">₱</span>
                  <input type="number" id="iConductorBond" class="form-control" min="0" step="0.01" value="0" oninput="calcNet()">
                </div>
              </div>
              <div class="col-md-4">
                <label class="form-label">Commission</label>
                <div class="input-group">
                  <span class="input-group-text">₱</span>
                  <input type="number" id="iCommission" class="form-control" min="0" step="0.01" value="0" oninput="calcNet()">
                </div>
              </div>
              <div class="col-12">
                <div class="net-display">
                  <div class="net-label">Net Income (Gross − Bond − Commission)</div>
                  <div class="net-value" id="netDisplay">₱0.00</div>
                </div>
              </div>
            </div>
          </div>
          <div id="tripTab2" style="display:none">
            <div class="row g-2">
              <div class="col-md-4"><label class="form-label">Diesel</label>
                <div class="input-group"><span class="input-group-text">₱</span>
                <input type="number" id="eDiesel" class="form-control" min="0" step="0.01" value="0" oninput="calcTotal()"></div></div>
              <div class="col-md-4"><label class="form-label">Washing</label>
                <div class="input-group"><span class="input-group-text">₱</span>
                <input type="number" id="eWashing" class="form-control" min="0" step="0.01" value="0" oninput="calcTotal()"></div></div>
              <div class="col-md-4"><label class="form-label">Driver Salary</label>
                <div class="input-group"><span class="input-group-text">₱</span>
                <input type="number" id="eSalary" class="form-control" min="0" step="0.01" value="1225" oninput="calcTotal()"></div></div>
              <div class="col-md-4"><label class="form-label">Overtime</label>
                <div class="input-group"><span class="input-group-text">₱</span>
                <input type="number" id="eOT" class="form-control" min="0" step="0.01" value="0" oninput="calcTotal()"></div></div>
              <div class="col-md-4"><label class="form-label">Night Differential</label>
                <div class="input-group"><span class="input-group-text">₱</span>
                <input type="number" id="eNight" class="form-control" min="0" step="0.01" value="0" oninput="calcTotal()"></div></div>
              <div class="col-md-4"><label class="form-label">Bonus</label>
                <div class="input-group"><span class="input-group-text">₱</span>
                <input type="number" id="eBonus" class="form-control" min="0" step="0.01" value="0" oninput="calcTotal()"></div></div>
              <div class="col-md-4"><label class="form-label">Cash Advance</label>
                <div class="input-group"><span class="input-group-text">₱</span>
                <input type="number" id="eCash" class="form-control" min="0" step="0.01" value="0" oninput="calcTotal()"></div></div>
              <div class="col-md-4"><label class="form-label">Damages</label>
                <div class="input-group"><span class="input-group-text">₱</span>
                <input type="number" id="eDamage" class="form-control" min="0" step="0.01" value="0" oninput="calcTotal()"></div></div>
              <div class="col-md-4"><label class="form-label">Other Expenses</label>
                <div class="input-group"><span class="input-group-text">₱</span>
                <input type="number" id="eOther" class="form-control" min="0" step="0.01" value="0" oninput="calcTotal()"></div></div>
              <div class="col-md-8"><label class="form-label">Damage Remark</label>
                <input type="text" id="eDamageRemark" class="form-control" placeholder="Describe the damage..."></div>
              <div class="col-md-4"><label class="form-label">Employee Responsible</label>
                <select id="eEmployeeId" class="form-select"><option value="">— None —</option></select></div>
              <div class="col-12">
                <div class="net-display" style="background:#fff3e0;border-left-color:#ef6c00">
                  <div class="net-label" style="color:#bf360c">Total Expenses</div>
                  <div class="net-value" style="color:#e65100" id="totalDisplay">₱0.00</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline-secondary btn-sm" id="tabPrev" onclick="switchTab(-1)" style="display:none">
            <i class="fas fa-chevron-left me-1"></i>Back
          </button>
          <button class="btn btn-primary btn-sm" id="tabNext" onclick="switchTab(1)">
            Next <i class="fas fa-chevron-right ms-1"></i>
          </button>
          <button class="btn btn-success btn-sm" id="tabSave" onclick="saveTripAll()" style="display:none">
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
  ['tDate','tDispatch','tArrival','tRemarks','iGross','iDriverIncome','iConductorIncome',
   'iDriverBond','iConductorBond','iCommission',
   'eDiesel','eWashing','eSalary','eOT','eNight','eBonus','eCash','eDamage','eOther','eDamageRemark'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = el.type === 'number' ? (id === 'eSalary' ? '1225' : '0') : '';
  });
  const eEmpSel = document.getElementById('eEmployeeId');
  if (eEmpSel) eEmpSel.value = '';
  document.getElementById('netDisplay').textContent = '₱0.00';
  document.getElementById('totalDisplay').textContent = '₱0.00';
  document.getElementById('tDate').value = new Date().toISOString().split('T')[0];
  populateTripDropdowns();
  switchTabTo(0);
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
  switchTabTo(0);
  new bootstrap.Modal(document.getElementById('tripModal')).show();
}

function populateTripDropdowns(busId, driverId, conductorId) {
  const activeBuses = tripBuses.filter(b => b.isActive || b.id == busId);
  document.getElementById('tBus').innerHTML =
    activeBuses.map(b => `<option value="${b.id}" ${b.id == busId ? 'selected' : ''}>${b.busNumber} — ${b.plateNo}</option>`).join('');
  document.getElementById('tDriver').innerHTML =
    tripDrivers.map(d => `<option value="${d.id}" ${d.id == driverId ? 'selected' : ''}>${d.fullName}</option>`).join('');
  document.getElementById('tConductor').innerHTML =
    tripConductors.map(c => `<option value="${c.id}" ${c.id == conductorId ? 'selected' : ''}>${c.fullName}</option>`).join('');
  // Populate employee responsible dropdown for damages
  const allEmps = [...tripDrivers, ...tripConductors].sort((a,b) => a.fullName.localeCompare(b.fullName));
  const empSel = document.getElementById('eEmployeeId');
  if (empSel) empSel.innerHTML = '<option value="">— None —</option>' +
    allEmps.map(e => `<option value="${e.id}">${e.fullName} (${e.position})</option>`).join('');
}

function switchTabTo(idx) {
  tripTabIdx = idx;
  [0,1,2].forEach(i => {
    document.getElementById(`tripTab${i}`).style.display = i === idx ? '' : 'none';
  });
  document.querySelectorAll('#tripTabs .nav-link').forEach((btn, i) => {
    btn.classList.toggle('active', i === idx);
  });
  document.getElementById('tabPrev').style.display = idx > 0 ? '' : 'none';
  document.getElementById('tabNext').style.display = idx < 2 ? '' : 'none';
  document.getElementById('tabSave').style.display = idx === 2 ? '' : 'none';
}

async function switchTab(dir) {
  const next = tripTabIdx + dir;
  if (next < 0 || next > 2) return;

  // Save trip details when moving from tab 0
  if (tripTabIdx === 0 && dir === 1) {
    const ok = await saveTripDetails();
    if (!ok) return;
  }
  switchTabTo(next);
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

  try {
    if (tripModalMode === 'add' && !savedTripId) {
      const trip = await api('/trips', 'POST', body);
      savedTripId = trip.id;
      toast('Trip created — now add income & expenses');
    } else if (tripModalMode === 'edit' && savedTripId) {
      await api(`/trips/${savedTripId}`, 'PUT', body);
      toast('Trip updated');
    }
    return true;
  } catch { return false; }
}

async function saveTripAll() {
  const btn = document.getElementById('tabSave');
  btn.disabled = true;
  try {
    // Save income
    await api(`/trips/${savedTripId}/income`, 'POST', {
      grossIncome:     +document.getElementById('iGross').value || 0,
      driverIncome:    +document.getElementById('iDriverIncome').value || 0,
      conductorIncome: +document.getElementById('iConductorIncome').value || 0,
      driverBond:      +document.getElementById('iDriverBond').value || 0,
      conductorBond:   +document.getElementById('iConductorBond').value || 0,
      commission:      +document.getElementById('iCommission').value || 0
    });
    // Save expenses
    await api(`/trips/${savedTripId}/expenses`, 'POST', {
      diesel:        +document.getElementById('eDiesel').value || 0,
      washing:       +document.getElementById('eWashing').value || 0,
      driverSalary:  +document.getElementById('eSalary').value || 0,
      overtime:      +document.getElementById('eOT').value || 0,
      nightDiff:     +document.getElementById('eNight').value || 0,
      bonus:         +document.getElementById('eBonus').value || 0,
      cashAdvance:   +document.getElementById('eCash').value || 0,
      damages:       +document.getElementById('eDamage').value || 0,
      damageRemark:  document.getElementById('eDamageRemark').value || null,
      employeeId:    document.getElementById('eEmployeeId').value ? +document.getElementById('eEmployeeId').value : null,
      otherExpenses: +document.getElementById('eOther').value || 0
    });
    toast('Trip saved successfully!');
    bootstrap.Modal.getInstance(document.getElementById('tripModal')).hide();
    renderTrips();
  } finally { if (btn) btn.disabled = false; }
}

function calcNet() {
  const g  = +document.getElementById('iGross').value || 0;
  const db = +document.getElementById('iDriverBond').value || 0;
  const cb = +document.getElementById('iConductorBond').value || 0;
  const c  = +document.getElementById('iCommission').value || 0;
  document.getElementById('netDisplay').textContent = peso(g - db - cb - c);
}

function calcTotal() {
  const ids = ['eDiesel','eWashing','eSalary','eOT','eNight','eBonus','eCash','eDamage','eOther'];
  const total = ids.reduce((s, id) => s + (+document.getElementById(id).value || 0), 0);
  document.getElementById('totalDisplay').textContent = peso(total);
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

  const [inc, exp] = await Promise.all([
    api(`/trips/${tripId}/income`).catch(() => null),
    api(`/trips/${tripId}/expenses`).catch(() => null)
  ]);

  const v = (obj, key, def = 0) => obj?.[key] ?? def;

  // Build employee dropdown for damages
  const allEmps2 = [...(tripDrivers||[]),...(tripConductors||[])].sort((a,b)=>a.fullName.localeCompare(b.fullName));
  const empOpts = '<option value="">— None —</option>' + allEmps2.map(e=>`<option value="${e.id}" ${e.id==v(exp,'employeeId')?'selected':''}>${e.fullName}</option>`).join('');

  document.getElementById('ieBody').innerHTML = `
    <div class="row g-3">
      <div class="col-md-6">
        <div class="section-header"><i class="fas fa-arrow-down me-1"></i>Income</div>
        <div class="mb-2"><label class="form-label">Gross Income</label>
          <div class="input-group"><span class="input-group-text">₱</span>
          <input type="number" id="ie_gross" class="form-control" value="${v(inc,'grossIncome')}" min="0" step="0.01" oninput="ieCalcNet()"></div></div>
        <div class="mb-2"><label class="form-label">Driver Income</label>
          <div class="input-group"><span class="input-group-text">₱</span>
          <input type="number" id="ie_dinc" class="form-control" value="${v(inc,'driverIncome')}" min="0" step="0.01" oninput="ieCalcNet()"></div></div>
        <div class="mb-2"><label class="form-label">Conductor Income</label>
          <div class="input-group"><span class="input-group-text">₱</span>
          <input type="number" id="ie_cinc" class="form-control" value="${v(inc,'conductorIncome')}" min="0" step="0.01" oninput="ieCalcNet()"></div></div>
        <div class="mb-2"><label class="form-label">Driver Bond</label>
          <div class="input-group"><span class="input-group-text">₱</span>
          <input type="number" id="ie_dbond" class="form-control" value="${v(inc,'driverBond')}" min="0" step="0.01" oninput="ieCalcNet()"></div></div>
        <div class="mb-2"><label class="form-label">Conductor Bond</label>
          <div class="input-group"><span class="input-group-text">₱</span>
          <input type="number" id="ie_cbond" class="form-control" value="${v(inc,'conductorBond')}" min="0" step="0.01" oninput="ieCalcNet()"></div></div>
        <div class="mb-2"><label class="form-label">Commission</label>
          <div class="input-group"><span class="input-group-text">₱</span>
          <input type="number" id="ie_comm" class="form-control" value="${v(inc,'commission')}" min="0" step="0.01" oninput="ieCalcNet()"></div></div>
        <div class="net-display mt-3">
          <div class="net-label">Net Income</div>
          <div class="net-value" id="ie_net">${peso(v(inc,'netIncome'))}</div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="section-header"><i class="fas fa-arrow-up me-1"></i>Expenses</div>
        ${[['ie_diesel','Diesel',v(exp,'diesel')],['ie_wash','Washing',v(exp,'washing')],
           ['ie_sal','Driver Salary',v(exp,'driverSalary',1225)],['ie_ot','Overtime',v(exp,'overtime')],
           ['ie_nd','Night Diff',v(exp,'nightDiff')],['ie_bonus','Bonus',v(exp,'bonus')],
           ['ie_ca','Cash Advance',v(exp,'cashAdvance')],['ie_dmg','Damages',v(exp,'damages')],
           ['ie_other','Other',v(exp,'otherExpenses')]].map(([id,lbl,val]) => `
          <div class="mb-1 row g-1 align-items-center">
            <div class="col-4"><label class="form-label mb-0" style="font-size:0.78rem">${lbl}</label></div>
            <div class="col-8"><div class="input-group input-group-sm">
              <span class="input-group-text">₱</span>
              <input type="number" id="${id}" class="form-control" value="${val}" min="0" step="0.01" oninput="ieCalcTotal()">
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
}

function ieCalcNet() {
  const g  = +document.getElementById('ie_gross').value || 0;
  const db = +document.getElementById('ie_dbond').value || 0;
  const cb = +document.getElementById('ie_cbond').value || 0;
  const c  = +document.getElementById('ie_comm').value || 0;
  document.getElementById('ie_net').textContent = peso(g - db - cb - c);
}

function ieCalcTotal() {
  const ids = ['ie_diesel','ie_wash','ie_sal','ie_ot','ie_nd','ie_bonus','ie_ca','ie_dmg','ie_other'];
  const t = ids.reduce((s,id) => s + (+document.getElementById(id).value||0), 0);
  document.getElementById('ie_total').textContent = peso(t);
}

async function saveIncomeExp() {
  try {
    await api(`/trips/${ieCurrentTripId}/income`, 'POST', {
      grossIncome:     +document.getElementById('ie_gross').value||0,
      driverIncome:    +document.getElementById('ie_dinc').value||0,
      conductorIncome: +document.getElementById('ie_cinc').value||0,
      driverBond:      +document.getElementById('ie_dbond').value||0,
      conductorBond:   +document.getElementById('ie_cbond').value||0,
      commission:      +document.getElementById('ie_comm').value||0
    });
    const empIdVal = document.getElementById('ie_empid').value;
    await api(`/trips/${ieCurrentTripId}/expenses`, 'POST', {
      diesel:        +document.getElementById('ie_diesel').value||0,
      washing:       +document.getElementById('ie_wash').value||0,
      driverSalary:  +document.getElementById('ie_sal').value||0,
      overtime:      +document.getElementById('ie_ot').value||0,
      nightDiff:     +document.getElementById('ie_nd').value||0,
      bonus:         +document.getElementById('ie_bonus').value||0,
      cashAdvance:   +document.getElementById('ie_ca').value||0,
      damages:       +document.getElementById('ie_dmg').value||0,
      damageRemark:  document.getElementById('ie_dremark').value||null,
      employeeId:    empIdVal ? +empIdVal : null,
      otherExpenses: +document.getElementById('ie_other').value||0
    });
    toast('Income & Expenses saved!');
    bootstrap.Modal.getInstance(document.getElementById('ieModal')).hide();
  } catch {}
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
  try {
    if (id) { await api(`/employees/${id}`, 'PUT', body); toast('Employee updated'); }
    else    { await api('/employees', 'POST', body); toast('Employee added'); }
    bootstrap.Modal.getInstance(document.getElementById('empModal')).hide();
    renderEmployees();
  } catch {}
}

async function toggleEmployee(id, active) {
  if (!confirm(`${active ? 'Activate' : 'Deactivate'} this employee?`)) return;
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
      <td><span class="status-badge ${b.isActive ? 'status-active' : 'status-inactive'}">${b.isActive ? 'Active' : 'Inactive'}</span></td>
      ${isAdmin() ? `<td>
        <button class="btn btn-outline-primary btn-icon me-1" onclick="openEditBus(${b.id})" title="Edit"><i class="fas fa-edit"></i></button>
        <button class="btn ${b.isActive ? 'btn-outline-danger' : 'btn-outline-success'} btn-icon"
          onclick="toggleBus(${b.id},${!b.isActive})" title="${b.isActive ? 'Deactivate' : 'Activate'}">
          <i class="fas ${b.isActive ? 'fa-ban' : 'fa-check'}"></i>
        </button>
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
  try {
    if (id) { await api(`/buses/${id}`, 'PUT', body); toast('Bus updated'); }
    else    { await api('/buses', 'POST', body); toast('Bus added'); }
    bootstrap.Modal.getInstance(document.getElementById('busModal')).hide();
    renderBuses();
  } catch {}
}

async function toggleBus(id, active) {
  if (!confirm(`${active ? 'Activate' : 'Deactivate'} this bus?`)) return;
  try {
    await api(`/buses/${id}/status`, 'PATCH', { isActive: active });
    toast(`Bus ${active ? 'activated' : 'deactivated'}`);
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
  try {
    await api(`/users/${id}/password`, 'PATCH', { newPassword: pw });
    toast('Password changed');
    bootstrap.Modal.getInstance(document.getElementById('passModal')).hide();
  } catch {}
}

async function toggleUser(id, active) {
  if (!confirm(`${active ? 'Activate' : 'Deactivate'} this account?`)) return;
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
let _dashChart = null;

async function renderDashboard() {
  const user  = getUser();
  const today = new Date().toISOString().split('T')[0];
  const mtdStart = today.slice(0, 8) + '01';
  const sevenAgo = new Date(Date.now() - 6 * 864e5).toISOString().split('T')[0];
  const dateLabel = new Date().toLocaleDateString('en-PH', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  shell('dashboard', `
    <div class="page-header">
      <div>
        <h4><i class="fas fa-th-large me-2"></i>Dashboard</h4>
        <div class="subtitle">${dateLabel}</div>
      </div>
    </div>
    <div class="dash-welcome mb-3 d-flex align-items-center gap-3">
      <div>
        <div class="dash-name">Welcome back, ${user?.fullName || user?.username || 'User'}!</div>
        <div class="dash-role"><i class="fas fa-id-badge me-1"></i>${user?.role || ''}</div>
      </div>
    </div>
    <div class="row g-3 mb-3" id="dashStats">
      <div class="col-6 col-md-3"><div class="stat-card blue"><div class="stat-label">Gross Income (MTD)</div><div class="stat-value" id="dGross">—</div><div class="dash-stat-trend neutral" id="dGrossTrend"></div></div></div>
      <div class="col-6 col-md-3"><div class="stat-card purple"><div class="stat-label">Total Trips (MTD)</div><div class="stat-value" id="dTrips">—</div><div class="dash-stat-trend neutral" id="dTripsTrend"></div></div></div>
      <div class="col-6 col-md-3"><div class="stat-card red"><div class="stat-label">Total Expenses (MTD)</div><div class="stat-value" id="dExp">—</div><div class="dash-stat-trend neutral" id="dExpTrend"></div></div></div>
      <div class="col-6 col-md-3"><div class="stat-card green"><div class="stat-label">Net Profit (MTD)</div><div class="stat-value" id="dProfit">—</div><div class="dash-stat-trend neutral" id="dProfitTrend"></div></div></div>
    </div>
    <div class="row g-3 mb-3">
      <div class="col-md-7">
        <div class="content-card p-3">
          <div class="dash-section-label">Gross Income vs Net Profit — Last 7 Days</div>
          <div class="dash-chart-wrap"><canvas id="dashChart"></canvas></div>
        </div>
      </div>
      <div class="col-md-5">
        <div class="content-card p-3" style="max-height:300px;overflow-y:auto">
          <div class="dash-section-label">Today's Trips</div>
          <div id="dashTodayTrips"><div class="text-muted small">Loading…</div></div>
        </div>
      </div>
    </div>
    ${isAdmin() ? `
    <div class="content-card p-3 mb-3">
      <div class="dash-section-label">Recent Activity</div>
      <div id="dashActivity"><div class="text-muted small">Loading…</div></div>
    </div>` : ''}
  `);

  if (_dashChart) { _dashChart.destroy(); _dashChart = null; }

  try {
    const [summary, todayTrips, tripReport, auditLog] = await Promise.all([
      api(`/reports/summary?from=${mtdStart}&to=${today}`),
      api(`/trips/date?date=${today}`),
      api(`/reports/trips?from=${sevenAgo}&to=${today}`),
      isAdmin() ? api(`/audit?from=${sevenAgo}&to=${today}`) : Promise.resolve([])
    ]);

    // Stat cards
    document.getElementById('dGross').textContent  = peso(summary.totalGrossIncome);
    document.getElementById('dTrips').textContent  = summary.totalTrips ?? '0';
    document.getElementById('dExp').textContent    = peso(summary.totalExpenses);
    document.getElementById('dProfit').textContent = peso(summary.totalNetProfit);

    // Chart — group trip report by date
    const byDate = {};
    (tripReport || []).forEach(r => {
      const d = r.tripDate;
      if (!byDate[d]) byDate[d] = { gross: 0, profit: 0 };
      byDate[d].gross  += Number(r.grossIncome  || 0);
      byDate[d].profit += Number(r.netProfit    || 0);
    });
    const labels  = [];
    const grossArr = [], profitArr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5).toISOString().split('T')[0];
      labels.push(new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month:'short', day:'numeric' }));
      grossArr.push(byDate[d]?.gross  || 0);
      profitArr.push(byDate[d]?.profit || 0);
    }
    const ctx = document.getElementById('dashChart').getContext('2d');
    _dashChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Gross Income', data: grossArr,  backgroundColor: 'rgba(30,136,229,0.7)',  borderRadius: 4 },
          { label: 'Net Profit',   data: profitArr, backgroundColor: 'rgba(67,160,71,0.7)',   borderRadius: 4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } },
        scales: { y: { ticks: { callback: v => '₱' + Number(v).toLocaleString('en-PH') } } }
      }
    });

    // Today's trips
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

    // Recent activity (admin only)
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
let _financeTab    = 'payroll';

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
        <button class="finance-tab-btn ${_financeTab==='payroll'?'active':''}" onclick="switchFinanceTab('payroll')">
          <i class="fas fa-users me-1"></i>Payroll
        </button>
        <button class="finance-tab-btn ${_financeTab==='treasury'?'active':''}" onclick="switchFinanceTab('treasury')">
          <i class="fas fa-landmark me-1"></i>Company Treasury
        </button>
      </div>
      <div id="financeContent" class="p-3"></div>
    </div>
  `);

  if (_financeTab === 'payroll') loadFinancePayroll();
  else loadFinanceTreasury();
}

let _finOffset = 0;
function shiftFinancePeriod(delta) {
  _finOffset += delta;
  _financePeriod = getBiMonthlyPeriod(_finOffset);
  const lbl = document.getElementById('finPeriodLabel');
  if (lbl) lbl.textContent = _financePeriod.label;
  if (_financeTab === 'payroll') loadFinancePayroll();
  else loadFinanceTreasury();
}

function switchFinanceTab(tab) {
  _financeTab = tab;
  document.querySelectorAll('.finance-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.finance-tab-btn').forEach(b => {
    if (b.textContent.toLowerCase().includes(tab === 'payroll' ? 'payroll' : 'treasury')) b.classList.add('active');
  });
  if (tab === 'payroll') loadFinancePayroll();
  else loadFinanceTreasury();
}

async function loadFinancePayroll() {
  const { from, to } = _financePeriod;
  const el = document.getElementById('financeContent');
  if (!el) return;
  el.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Loading payroll…</div>';

  try {
    const [records, computed] = await Promise.all([
      api(`/payroll/records?from=${from}&to=${to}`),
      api(`/payroll/compute?from=${from}&to=${to}`)
    ]);

    const hasRecords  = records.length > 0;
    const totalNet    = computed.reduce((s, r) => s + Number(r.netPay || 0), 0);
    const paidCount   = records.filter(r => r.status === 'PAID').length;

    const rowData = hasRecords ? records : computed;

    el.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div class="text-muted small">
          ${hasRecords
            ? `<span class="badge bg-secondary">${records.length} records</span> &nbsp; <span class="badge bg-success">${paidCount} paid</span> &nbsp; <span class="badge bg-warning text-dark">${records.length - paidCount} pending</span>`
            : `<span class="badge bg-light text-dark border">Preview — not yet generated</span>`}
        </div>
        <div class="d-flex gap-2">
          <span class="fw-bold">Total Payroll: ${peso(totalNet)}</span>
          ${!hasRecords
            ? `<button class="btn btn-primary btn-sm" onclick="generatePayroll('${from}','${to}')"><i class="fas fa-cogs me-1"></i>Generate Payroll</button>`
            : `<button class="btn btn-outline-secondary btn-sm" onclick="generatePayroll('${from}','${to}')"><i class="fas fa-sync me-1"></i>Add Missing</button>`}
        </div>
      </div>
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead><tr>
            <th>Code</th><th>Employee</th><th>Position</th><th>Trips</th>
            <th>Gross Pay</th><th>Deductions</th><th>Net Pay</th>
            <th>Status</th><th></th>
          </tr></thead>
          <tbody>
            ${rowData.map(r => {
              const isRecord = hasRecords;
              const status   = isRecord ? r.status : 'PREVIEW';
              const badgeCls = status === 'PAID' ? 'payroll-paid' : status === 'PENDING' ? 'payroll-pending' : 'text-muted small';
              const badgeTxt = status === 'PAID'
                ? `<span class="payroll-paid">PAID<br><small>${r.paidAt ? new Date(r.paidAt).toLocaleDateString('en-PH') : ''}</small></span>`
                : status === 'PENDING'
                  ? `<span class="payroll-pending">PENDING</span>`
                  : `<span class="text-muted small">—</span>`;
              const actionBtn = (isRecord && status === 'PENDING')
                ? `<button class="btn btn-success btn-sm btn-icon" onclick="markPayrollPaid(${r.id})" title="Mark as Paid"><i class="fas fa-check"></i></button>`
                : '';
              return `<tr>
                <td><code>${r.employeeCode}</code></td>
                <td><strong>${r.fullName}</strong></td>
                <td><span class="status-badge ${{DRIVER:'status-driver',CONDUCTOR:'status-conductor',HR:'status-hr',OPERATIONS:'status-operations',MECHANIC:'status-mechanic'}[r.position]||''}">${r.position}</span></td>
                <td class="text-center">${r.tripCount || 0}</td>
                <td>${peso(r.grossPay)}</td>
                <td class="text-danger">${Number(r.deductions||0) > 0 ? '−' + peso(r.deductions) : '—'}</td>
                <td><strong>${peso(r.netPay)}</strong></td>
                <td>${badgeTxt}</td>
                <td>${actionBtn}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  } catch {
    el.innerHTML = '<div class="alert alert-danger">Failed to load payroll data.</div>';
  }
}

async function generatePayroll(from, to) {
  try {
    const r = await api('/payroll/generate', 'POST', { from, to });
    toast(`Payroll generated — ${r.generated} record(s) created`);
    loadFinancePayroll();
  } catch {}
}

async function markPayrollPaid(id) {
  try {
    await api(`/payroll/${id}/pay`, 'PATCH');
    toast('Marked as paid');
    loadFinancePayroll();
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
        <div class="treasury-row"><span>Net Income after bonds &amp; commission</span><span class="fw-semibold">${peso(s.totalNetIncome)}</span></div>
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
