/**
 * HALCYON AI RECEPTIONIST - DASHBOARD APP
 *
 * Frontend JavaScript for the intake management dashboard
 */

// API Configuration
const API_BASE = '/api/dashboard';

// Current state
let currentView = 'dashboard';
let currentIntake = null;
let currentMessage = null;
let intakesPage = 1;
let intakesPageSize = 20;
let messagesPage = 1;
let messagesPageSize = 20;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initFilters();
  loadDashboard();
  loadMessagesBadge();

  // Refresh messages badge every 30 seconds
  setInterval(loadMessagesBadge, 30000);
});

function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      switchView(view);
    });
  });
}

function switchView(view) {
  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });

  // Update view visibility
  document.querySelectorAll('.view').forEach(v => {
    v.classList.toggle('active', v.id === `${view}-view`);
  });

  currentView = view;

  // Load view data
  switch (view) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'messages':
      loadMessages();
      break;
    case 'intakes':
      loadIntakes();
      break;
    case 'tasks':
      loadTasks();
      break;
    case 'reports':
      loadReports();
      break;
  }
}

function initFilters() {
  // Date range filter
  document.getElementById('date-range')?.addEventListener('change', () => {
    loadDashboard();
  });

  // Intakes filters
  document.getElementById('search-intakes')?.addEventListener('input', debounce(() => {
    intakesPage = 1;
    loadIntakes();
  }, 300));

  document.getElementById('filter-status')?.addEventListener('change', () => {
    intakesPage = 1;
    loadIntakes();
  });

  document.getElementById('filter-score')?.addEventListener('change', () => {
    intakesPage = 1;
    loadIntakes();
  });

  // Tasks filter
  document.getElementById('filter-task-status')?.addEventListener('change', () => {
    loadTasks();
  });

  // Messages filters
  document.getElementById('filter-message-status')?.addEventListener('change', () => {
    messagesPage = 1;
    loadMessages();
  });

  document.getElementById('filter-message-category')?.addEventListener('change', () => {
    messagesPage = 1;
    loadMessages();
  });
}

// ============================================
// DASHBOARD
// ============================================

async function loadDashboard() {
  const dateRange = document.getElementById('date-range')?.value || 'week';
  const { startDate, endDate } = getDateRange(dateRange);

  try {
    const stats = await fetchAPI(`/stats?startDate=${startDate}&endDate=${endDate}`);

    // Update stat cards
    document.getElementById('stat-total').textContent = stats.totalIntakes || 0;
    document.getElementById('stat-urgent').textContent = stats.urgentCases || 0;
    document.getElementById('stat-avg-score').textContent = stats.avgScore ? Math.round(stats.avgScore) : '-';
    document.getElementById('stat-pending-tasks').textContent = stats.pendingTasks || 0;

    // Update score bars - scoreBuckets is an array of {bucket, count}
    const total = stats.totalIntakes || 1;
    const buckets = stats.scoreBuckets || [];
    const high = buckets.find(b => b.bucket === 'high')?.count || 0;
    const medium = buckets.find(b => b.bucket === 'medium')?.count || 0;
    const low = (buckets.find(b => b.bucket === 'low')?.count || 0) +
                (buckets.find(b => b.bucket === 'very_low')?.count || 0);

    document.getElementById('bar-high').style.width = `${(high / total) * 100}%`;
    document.getElementById('bar-medium').style.width = `${(medium / total) * 100}%`;
    document.getElementById('bar-low').style.width = `${(low / total) * 100}%`;

    document.getElementById('count-high').textContent = high;
    document.getElementById('count-medium').textContent = medium;
    document.getElementById('count-low').textContent = low;

    // Load recent intakes
    const intakesResult = await fetchAPI(`/intakes?pageSize=5&startDate=${startDate}&endDate=${endDate}`);
    renderRecentIntakes(intakesResult.intakes || []);

  } catch (error) {
    console.error('Failed to load dashboard:', error);
  }
}

function renderRecentIntakes(intakes) {
  const tbody = document.getElementById('recent-intakes');

  if (intakes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="loading">No intakes found</td></tr>';
    return;
  }

  tbody.innerHTML = intakes.map(intake => `
    <tr>
      <td>${formatTime(intake.createdAt)}</td>
      <td>${intake.firstName || 'Unknown'} ${intake.lastName || ''}</td>
      <td><span class="badge badge-${getScoreClass(intake.totalScore)}">${intake.totalScore || '-'}</span></td>
      <td><span class="badge badge-${getStatusClass(intake.status)}">${formatStatus(intake.status)}</span></td>
      <td><button class="btn btn-sm" onclick="viewIntake('${intake.id}')">View</button></td>
    </tr>
  `).join('');
}

// ============================================
// INTAKES
// ============================================

async function loadIntakes() {
  const search = document.getElementById('search-intakes')?.value || '';
  const status = document.getElementById('filter-status')?.value || '';
  const scoreFilter = document.getElementById('filter-score')?.value || '';

  let params = new URLSearchParams({
    page: intakesPage,
    pageSize: intakesPageSize
  });

  if (search) params.append('search', search);
  if (status) params.append('status', status);

  if (scoreFilter === 'high') {
    params.append('minScore', '70');
  } else if (scoreFilter === 'medium') {
    params.append('minScore', '45');
    params.append('maxScore', '69');
  } else if (scoreFilter === 'low') {
    params.append('maxScore', '44');
  }

  try {
    const result = await fetchAPI(`/intakes?${params}`);
    renderIntakesList(result.intakes || []);
    renderPagination(result.pagination);
  } catch (error) {
    console.error('Failed to load intakes:', error);
  }
}

function renderIntakesList(intakes) {
  const tbody = document.getElementById('intakes-list');

  if (intakes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading">No intakes found</td></tr>';
    return;
  }

  tbody.innerHTML = intakes.map(intake => `
    <tr>
      <td>${formatDate(intake.createdAt)}</td>
      <td>${intake.intakeId}</td>
      <td>${intake.firstName || 'Unknown'} ${intake.lastName || ''}</td>
      <td>${intake.callerPhone || '-'}</td>
      <td>${intake.city || '-'}, ${intake.state || '-'}</td>
      <td><span class="badge badge-${getScoreClass(intake.totalScore)}">${intake.totalScore || '-'}</span></td>
      <td><span class="badge badge-${getStatusClass(intake.status)}">${formatStatus(intake.status)}</span></td>
      <td>
        <button class="btn btn-sm" onclick="viewIntake('${intake.id}')">View</button>
      </td>
    </tr>
  `).join('');
}

function renderPagination(pagination) {
  if (!pagination) return;

  const container = document.getElementById('intakes-pagination');
  const { page, totalPages, total } = pagination;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';

  html += `<button ${page <= 1 ? 'disabled' : ''} onclick="goToPage(${page - 1})">Prev</button>`;

  for (let i = 1; i <= Math.min(totalPages, 5); i++) {
    html += `<button class="${i === page ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }

  if (totalPages > 5) {
    html += `<span>... of ${totalPages}</span>`;
  }

  html += `<button ${page >= totalPages ? 'disabled' : ''} onclick="goToPage(${page + 1})">Next</button>`;

  container.innerHTML = html;
}

function goToPage(page) {
  intakesPage = page;
  loadIntakes();
}

// ============================================
// INTAKE DETAIL
// ============================================

async function viewIntake(id) {
  try {
    currentIntake = await fetchAPI(`/intakes/${id}`);
    renderIntakeDetail(currentIntake);
    openModal();
  } catch (error) {
    console.error('Failed to load intake:', error);
    alert('Failed to load intake details');
  }
}

function renderIntakeDetail(intake) {
  const container = document.getElementById('intake-detail');

  const scoreClass = getScoreClass(intake.totalScore);
  const conditions = intake.conditions || [];
  const medications = intake.medications || [];
  const strengths = intake.caseStrengths || [];
  const concerns = intake.caseConcerns || [];

  container.innerHTML = `
    <div class="intake-detail-grid">
      <div>
        <div class="detail-section">
          <h4>Contact Information</h4>
          <div class="detail-row">
            <span class="detail-label">Name</span>
            <span class="detail-value">${intake.firstName || '-'} ${intake.lastName || ''}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Phone</span>
            <span class="detail-value">${intake.callerPhone || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Email</span>
            <span class="detail-value">${intake.email || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Location</span>
            <span class="detail-value">${intake.city || '-'}, ${intake.state || '-'}</span>
          </div>
        </div>

        <div class="detail-section">
          <h4>Demographics</h4>
          <div class="detail-row">
            <span class="detail-label">Age</span>
            <span class="detail-value">${intake.age || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Date of Birth</span>
            <span class="detail-value">${intake.dateOfBirth ? formatDate(intake.dateOfBirth) : '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Education</span>
            <span class="detail-value">${intake.educationLevel || '-'}</span>
          </div>
        </div>

        <div class="detail-section">
          <h4>Work History</h4>
          <div class="detail-row">
            <span class="detail-label">Currently Working</span>
            <span class="detail-value">${intake.currentlyWorking ? 'Yes' : 'No'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Last Work Date</span>
            <span class="detail-value">${intake.lastWorkDate ? formatDate(intake.lastWorkDate) : '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Last Job Type</span>
            <span class="detail-value">${intake.lastJobType || '-'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Years Worked</span>
            <span class="detail-value">${intake.totalWorkYears || '-'}</span>
          </div>
        </div>
      </div>

      <div>
        <div class="detail-section">
          <h4>Case Score</h4>
          <div class="score-display ${scoreClass}">${intake.totalScore || '-'}</div>
          <div class="detail-row">
            <span class="detail-label">Recommendation</span>
            <span class="detail-value">${formatRecommendation(intake.recommendation)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Urgent</span>
            <span class="detail-value">${intake.isUrgent ? '<span class="badge badge-urgent">URGENT</span>' : 'No'}</span>
          </div>
        </div>

        <div class="detail-section">
          <h4>Medical Conditions</h4>
          ${conditions.length > 0 ? `
            <ul style="padding-left: 1rem;">
              ${conditions.map(c => `<li>${c}</li>`).join('')}
            </ul>
          ` : '<p>No conditions recorded</p>'}
        </div>

        <div class="detail-section">
          <h4>Medications</h4>
          ${medications.length > 0 ? `
            <ul style="padding-left: 1rem;">
              ${medications.map(m => `<li>${m}</li>`).join('')}
            </ul>
          ` : '<p>No medications recorded</p>'}
        </div>

        ${strengths.length > 0 ? `
        <div class="detail-section">
          <h4>Case Strengths</h4>
          <ul class="strengths-list">
            ${strengths.map(s => `<li>${s}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        ${concerns.length > 0 ? `
        <div class="detail-section">
          <h4>Concerns</h4>
          <ul class="concerns-list">
            ${concerns.map(c => `<li>${c}</li>`).join('')}
          </ul>
        </div>
        ` : ''}
      </div>
    </div>

    ${intake.aiSummary ? `
    <div class="detail-section" style="margin-top: 1rem;">
      <h4>AI Summary</h4>
      <p>${intake.aiSummary}</p>
    </div>
    ` : ''}

    <div class="detail-section" style="margin-top: 1rem;">
      <h4>Application Status</h4>
      <div class="detail-row">
        <span class="detail-label">Status</span>
        <span class="detail-value">${intake.applicationStatus || 'Not Applied'}</span>
      </div>
      ${intake.denialDate ? `
      <div class="detail-row">
        <span class="detail-label">Denial Date</span>
        <span class="detail-value">${formatDate(intake.denialDate)}</span>
      </div>
      ` : ''}
      ${intake.hearingDate ? `
      <div class="detail-row">
        <span class="detail-label">Hearing Date</span>
        <span class="detail-value">${formatDate(intake.hearingDate)}</span>
      </div>
      ` : ''}
    </div>

    <div class="detail-section" style="margin-top: 1rem;">
      <h4>Call Details</h4>
      <div class="detail-row">
        <span class="detail-label">Call ID</span>
        <span class="detail-value">${intake.callId || '-'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Intake ID</span>
        <span class="detail-value">${intake.intakeId || '-'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Created</span>
        <span class="detail-value">${formatDateTime(intake.createdAt)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Status</span>
        <span class="detail-value"><span class="badge badge-${getStatusClass(intake.status)}">${formatStatus(intake.status)}</span></span>
      </div>
    </div>
  `;
}

function openModal() {
  document.getElementById('intake-modal').classList.add('active');
}

function closeModal() {
  document.getElementById('intake-modal').classList.remove('active');
  currentIntake = null;
}

// ============================================
// QUICK ACTIONS
// ============================================

async function acceptCase() {
  if (!currentIntake) return;

  const reviewedBy = prompt('Your name:');
  if (!reviewedBy) return;

  try {
    await fetchAPI(`/intakes/${currentIntake.id}/accept`, {
      method: 'POST',
      body: JSON.stringify({ reviewedBy })
    });

    alert('Case accepted successfully!');
    closeModal();
    refreshCurrentView();
  } catch (error) {
    console.error('Failed to accept case:', error);
    alert('Failed to accept case');
  }
}

async function declineCase() {
  if (!currentIntake) return;

  const reviewedBy = prompt('Your name:');
  if (!reviewedBy) return;

  const reason = prompt('Reason for declining:');
  if (!reason) return;

  try {
    await fetchAPI(`/intakes/${currentIntake.id}/decline`, {
      method: 'POST',
      body: JSON.stringify({ reviewedBy, reason })
    });

    alert('Case declined');
    closeModal();
    refreshCurrentView();
  } catch (error) {
    console.error('Failed to decline case:', error);
    alert('Failed to decline case');
  }
}

async function scheduleCallback() {
  if (!currentIntake) return;

  const assignedTo = prompt('Assigned to:');
  if (!assignedTo) return;

  const callbackDate = prompt('Callback date (YYYY-MM-DD HH:MM):');
  if (!callbackDate) return;

  try {
    await fetchAPI(`/intakes/${currentIntake.id}/schedule-callback`, {
      method: 'POST',
      body: JSON.stringify({
        callbackDate: new Date(callbackDate).toISOString(),
        assignedTo
      })
    });

    alert('Callback scheduled!');
    closeModal();
  } catch (error) {
    console.error('Failed to schedule callback:', error);
    alert('Failed to schedule callback');
  }
}

// ============================================
// TASKS
// ============================================

async function loadTasks() {
  const status = document.getElementById('filter-task-status')?.value || 'PENDING';

  let params = new URLSearchParams();
  if (status) params.append('status', status);

  try {
    const tasks = await fetchAPI(`/tasks?${params}`);
    renderTasksList(tasks);
  } catch (error) {
    console.error('Failed to load tasks:', error);
  }
}

function renderTasksList(tasks) {
  const tbody = document.getElementById('tasks-list');

  if (tasks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">No tasks found</td></tr>';
    return;
  }

  tbody.innerHTML = tasks.map(task => `
    <tr>
      <td><span class="badge badge-${getPriorityClass(task.priority)}">${task.priority}</span></td>
      <td>${task.title}</td>
      <td>${task.intake ? `${task.intake.firstName || ''} ${task.intake.lastName || ''}` : '-'}</td>
      <td>${task.dueDate ? formatDate(task.dueDate) : '-'}</td>
      <td>${task.assignedTo || '-'}</td>
      <td>
        ${task.status !== 'COMPLETED' ? `
          <button class="btn btn-sm btn-success" onclick="completeTask('${task.id}')">Complete</button>
        ` : '<span class="badge badge-accepted">Done</span>'}
      </td>
    </tr>
  `).join('');
}

async function completeTask(id) {
  const completedBy = prompt('Completed by:');
  if (!completedBy) return;

  try {
    await fetchAPI(`/tasks/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ completedBy })
    });

    loadTasks();
  } catch (error) {
    console.error('Failed to complete task:', error);
    alert('Failed to complete task');
  }
}

// ============================================
// MESSAGES
// ============================================

async function loadMessagesBadge() {
  try {
    const result = await fetchAPI('/messages?status=PENDING&pageSize=1');
    const badge = document.getElementById('messages-badge');
    if (badge && result.pagination.total > 0) {
      badge.textContent = result.pagination.total;
      badge.style.display = 'inline';
    } else if (badge) {
      badge.style.display = 'none';
    }
  } catch (error) {
    console.error('Failed to load messages badge:', error);
  }
}

async function loadMessages() {
  const status = document.getElementById('filter-message-status')?.value || 'PENDING';
  const category = document.getElementById('filter-message-category')?.value || '';

  let params = new URLSearchParams({
    page: messagesPage,
    pageSize: messagesPageSize
  });

  if (status) params.append('status', status);
  if (category) params.append('category', category);

  try {
    // Load messages and stats in parallel
    const [result, statsResult] = await Promise.all([
      fetchAPI(`/messages?${params}`),
      fetchAPI('/messages?status=PENDING&pageSize=1000')
    ]);

    // Calculate stats
    const pendingCount = statsResult.pagination.total;
    const urgentCount = statsResult.requests.filter(m => m.priority === 'URGENT').length;
    const today = new Date().toDateString();
    const todayCount = statsResult.requests.filter(m => new Date(m.createdAt).toDateString() === today).length;

    // Update stats
    document.getElementById('stat-pending-messages').textContent = pendingCount;
    document.getElementById('stat-urgent-messages').textContent = urgentCount;
    document.getElementById('stat-today-messages').textContent = todayCount;

    renderMessagesList(result.requests || []);
    renderMessagesPagination(result.pagination);
    loadMessagesBadge();
  } catch (error) {
    console.error('Failed to load messages:', error);
  }
}

function renderMessagesList(messages) {
  const tbody = document.getElementById('messages-list');

  if (messages.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading">No messages found</td></tr>';
    return;
  }

  tbody.innerHTML = messages.map(msg => `
    <tr>
      <td>${formatDateTime(msg.createdAt)}</td>
      <td><span class="badge badge-${getPriorityClass(msg.priority)}">${msg.priority}</span></td>
      <td>${msg.callerName || 'Unknown'}</td>
      <td>${msg.callerPhone || '-'}</td>
      <td><span class="badge">${formatCategory(msg.category)}</span></td>
      <td class="purpose-cell">${truncate(msg.purpose, 40)}</td>
      <td><span class="badge badge-${getMessageStatusClass(msg.status)}">${formatStatus(msg.status)}</span></td>
      <td>
        <button class="btn btn-sm" onclick="viewMessage('${msg.id}')">View</button>
        ${msg.status === 'PENDING' ? `<button class="btn btn-sm btn-success" onclick="quickCompleteMessage('${msg.id}')">Done</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function renderMessagesPagination(pagination) {
  if (!pagination) return;

  const container = document.getElementById('messages-pagination');
  const { page, totalPages, total } = pagination;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  html += `<button ${page <= 1 ? 'disabled' : ''} onclick="goToMessagesPage(${page - 1})">Prev</button>`;

  for (let i = 1; i <= Math.min(totalPages, 5); i++) {
    html += `<button class="${i === page ? 'active' : ''}" onclick="goToMessagesPage(${i})">${i}</button>`;
  }

  if (totalPages > 5) {
    html += `<span>... of ${totalPages}</span>`;
  }

  html += `<button ${page >= totalPages ? 'disabled' : ''} onclick="goToMessagesPage(${page + 1})">Next</button>`;

  container.innerHTML = html;
}

function goToMessagesPage(page) {
  messagesPage = page;
  loadMessages();
}

async function viewMessage(id) {
  try {
    currentMessage = await fetchAPI(`/messages/${id}`);
    renderMessageDetail(currentMessage);
    openMessageModal();
  } catch (error) {
    console.error('Failed to load message:', error);
    alert('Failed to load message details');
  }
}

function renderMessageDetail(msg) {
  const container = document.getElementById('message-detail');

  container.innerHTML = `
    <div class="detail-section">
      <h4>Caller Information</h4>
      <div class="detail-row">
        <span class="detail-label">Name</span>
        <span class="detail-value">${msg.callerName || 'Unknown'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Phone</span>
        <span class="detail-value">${msg.callerPhone || '-'}</span>
      </div>
    </div>

    <div class="detail-section">
      <h4>Request Details</h4>
      <div class="detail-row">
        <span class="detail-label">Category</span>
        <span class="detail-value"><span class="badge">${formatCategory(msg.category)}</span></span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Priority</span>
        <span class="detail-value"><span class="badge badge-${getPriorityClass(msg.priority)}">${msg.priority}</span></span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Purpose</span>
        <span class="detail-value">${msg.purpose}</span>
      </div>
      ${msg.notes ? `
      <div class="detail-row">
        <span class="detail-label">Notes</span>
        <span class="detail-value">${msg.notes}</span>
      </div>
      ` : ''}
    </div>

    <div class="detail-section">
      <h4>Status</h4>
      <div class="detail-row">
        <span class="detail-label">Status</span>
        <span class="detail-value"><span class="badge badge-${getMessageStatusClass(msg.status)}">${formatStatus(msg.status)}</span></span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Received</span>
        <span class="detail-value">${formatDateTime(msg.createdAt)}</span>
      </div>
      ${msg.completedAt ? `
      <div class="detail-row">
        <span class="detail-label">Completed</span>
        <span class="detail-value">${formatDateTime(msg.completedAt)} by ${msg.completedBy || 'Unknown'}</span>
      </div>
      ` : ''}
      ${msg.resolution ? `
      <div class="detail-row">
        <span class="detail-label">Resolution</span>
        <span class="detail-value">${msg.resolution}</span>
      </div>
      ` : ''}
    </div>

    ${msg.transcript && msg.transcript.length > 0 ? `
    <div class="detail-section">
      <h4>Call Transcript</h4>
      <div class="transcript">
        ${msg.transcript.map(t => `
          <div class="transcript-line ${t.role}">
            <strong>${t.role === 'assistant' ? 'AI' : 'Caller'}:</strong> ${t.text}
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
  `;
}

function openMessageModal() {
  document.getElementById('message-modal').classList.add('active');
}

function closeMessageModal() {
  document.getElementById('message-modal').classList.remove('active');
  currentMessage = null;
}

async function completeMessage() {
  if (!currentMessage) return;

  const completedBy = prompt('Your name:');
  if (!completedBy) return;

  const resolution = prompt('Resolution/notes (optional):');

  try {
    await fetchAPI(`/messages/${currentMessage.id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ completedBy, resolution })
    });

    alert('Message marked as completed!');
    closeMessageModal();
    loadMessages();
  } catch (error) {
    console.error('Failed to complete message:', error);
    alert('Failed to update message');
  }
}

async function quickCompleteMessage(id) {
  const completedBy = prompt('Your name:');
  if (!completedBy) return;

  try {
    await fetchAPI(`/messages/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ completedBy })
    });

    loadMessages();
  } catch (error) {
    console.error('Failed to complete message:', error);
    alert('Failed to update message');
  }
}

async function scheduleMessageCallback() {
  if (!currentMessage) return;

  const callbackDate = prompt('Callback date and time (YYYY-MM-DD HH:MM):');
  if (!callbackDate) return;

  try {
    await fetchAPI(`/messages/${currentMessage.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'SCHEDULED'
      })
    });

    alert('Callback scheduled!');
    closeMessageModal();
    loadMessages();
  } catch (error) {
    console.error('Failed to schedule callback:', error);
    alert('Failed to schedule callback');
  }
}

function formatCategory(category) {
  const categoryMap = {
    'GENERAL': 'General',
    'EXISTING_CLIENT': 'Existing Client',
    'CASE_STATUS': 'Case Status',
    'BILLING': 'Billing',
    'DOCUMENTS': 'Documents',
    'REFERRAL': 'Referral',
    'VENDOR': 'Vendor',
    'OTHER': 'Other'
  };
  return categoryMap[category] || category;
}

function getMessageStatusClass(status) {
  const classMap = {
    'PENDING': 'pending',
    'SCHEDULED': 'medium',
    'COMPLETED': 'accepted',
    'CANCELLED': 'declined'
  };
  return classMap[status] || 'pending';
}

function truncate(text, maxLength) {
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// ============================================
// REPORTS
// ============================================

async function loadReports() {
  try {
    const [conversion, scoreDistribution] = await Promise.all([
      fetchAPI('/reports/conversion'),
      fetchAPI('/reports/score-distribution')
    ]);

    renderConversionFunnel(conversion);
    renderStatusBreakdown(conversion.byStatus);
  } catch (error) {
    console.error('Failed to load reports:', error);
  }
}

function renderConversionFunnel(data) {
  const container = document.getElementById('conversion-funnel');
  const total = data.totalIntakes || 1;

  const stages = [
    { label: 'Total Intakes', value: data.totalIntakes, percent: 100 },
    { label: 'Reviewed', value: (data.byStatus?.REVIEWED || 0) + (data.byStatus?.ACCEPTED || 0) + (data.byStatus?.DECLINED || 0), percent: 0 },
    { label: 'Accepted', value: data.byStatus?.ACCEPTED || 0, percent: 0 }
  ];

  stages[1].percent = Math.round((stages[1].value / total) * 100);
  stages[2].percent = Math.round((stages[2].value / total) * 100);

  container.innerHTML = stages.map(stage => `
    <div class="funnel-item">
      <span class="funnel-label">${stage.label}</span>
      <div class="funnel-bar" style="width: ${stage.percent}%">${stage.value}</div>
    </div>
  `).join('');
}

function renderStatusBreakdown(statusCounts) {
  const container = document.getElementById('status-breakdown');

  if (!statusCounts) {
    container.innerHTML = '<p>No data available</p>';
    return;
  }

  const statuses = Object.entries(statusCounts);
  const total = statuses.reduce((sum, [, count]) => sum + count, 0) || 1;

  container.innerHTML = `
    <div class="score-bars">
      ${statuses.map(([status, count]) => `
        <div class="score-bar-container">
          <span class="score-label">${formatStatus(status)}</span>
          <div class="score-bar">
            <div class="score-bar-fill" style="width: ${(count / total) * 100}%; background: var(--primary);"></div>
          </div>
          <span class="score-count">${count}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================
// UTILITIES
// ============================================

async function fetchAPI(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

function refreshCurrentView() {
  switch (currentView) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'messages':
      loadMessages();
      break;
    case 'intakes':
      loadIntakes();
      break;
    case 'tasks':
      loadTasks();
      break;
    case 'reports':
      loadReports();
      break;
  }
}

function getDateRange(range) {
  const now = new Date();
  let startDate, endDate;

  switch (range) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      break;
    case 'week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      endDate = now;
      break;
    case 'month':
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
      endDate = now;
      break;
    case 'all':
    default:
      startDate = new Date('2020-01-01');
      endDate = new Date('2030-12-31');
      break;
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  };
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
}

function formatTime(date) {
  if (!date) return '-';
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}

function formatStatus(status) {
  const statusMap = {
    'NEW': 'New',
    'PENDING_REVIEW': 'Pending',
    'REVIEWED': 'Reviewed',
    'ACCEPTED': 'Accepted',
    'DECLINED': 'Declined',
    'PENDING': 'Pending',
    'IN_PROGRESS': 'In Progress',
    'COMPLETED': 'Completed'
  };
  return statusMap[status] || status;
}

function formatRecommendation(rec) {
  const recMap = {
    'highly_recommended': 'Highly Recommended',
    'recommended': 'Recommended',
    'consider_caution': 'Consider with Caution',
    'weak_case': 'Weak Case',
    'not_recommended': 'Not Recommended'
  };
  return recMap[rec] || rec || '-';
}

function getScoreClass(score) {
  if (!score) return 'low';
  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

function getStatusClass(status) {
  const classMap = {
    'NEW': 'new',
    'PENDING_REVIEW': 'pending',
    'REVIEWED': 'medium',
    'ACCEPTED': 'accepted',
    'DECLINED': 'declined'
  };
  return classMap[status] || 'pending';
}

function getPriorityClass(priority) {
  const classMap = {
    'URGENT': 'urgent',
    'HIGH': 'low',
    'MEDIUM': 'medium',
    'LOW': 'high'
  };
  return classMap[priority] || 'medium';
}

function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Close modal on escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});

// Close modal on backdrop click
document.getElementById('intake-modal')?.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    closeModal();
  }
});
