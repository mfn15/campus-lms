const App = {
  currentUser: null,
  currentCourse: null,
  currentAssignment: null,

  async init() {
    this.bindLogin();
    document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => this.showView(b.dataset.view)));
    document.getElementById('logout-btn').addEventListener('click', async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.reload(); });
    document.getElementById('new-course-btn').addEventListener('click', () => this.createCourse());
    document.getElementById('cd-post-announcement').addEventListener('click', () => this.postAnnouncement());
    document.getElementById('cd-new-assignment-btn').addEventListener('click', () => this.createAssignment());
    document.getElementById('cd-enroll-btn').addEventListener('click', () => this.enrollStudent());
    document.getElementById('ad-submit-btn').addEventListener('click', () => this.submitAssignment());

    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) { this.currentUser = await res.json(); this.showApp(); }
    } catch (e) { /* not logged in */ }
  },

  bindLogin() {
    document.getElementById('login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const data = await res.json();
      if (!res.ok) { document.getElementById('login-error').textContent = data.error; return; }
      this.currentUser = data.user;
      this.showApp();
    });
  },

  showApp() {
    document.getElementById('login-screen').hidden = true;
    document.getElementById('app-screen').hidden = false;
    document.getElementById('current-user-name').textContent = `${this.currentUser.name} (${this.currentUser.role})`;
    document.getElementById('new-course-form').hidden = this.currentUser.role === 'student';
    this.loadDashboard();
  },

  showView(view) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    if (view === 'dashboard') this.loadDashboard();
    if (view === 'courses') this.loadCourses();
  },

  async loadDashboard() {
    const d = await fetch('/api/dashboard').then(r => r.json());
    const grid = document.getElementById('dashboard-stats');
    const extra = document.getElementById('dashboard-extra');
    if (d.role === 'admin') {
      grid.innerHTML = statCard('Courses', d.courses) + statCard('Students', d.students) + statCard('Teachers', d.teachers) + statCard('Assignments', d.assignments);
      extra.innerHTML = '';
    } else if (d.role === 'teacher') {
      grid.innerHTML = statCard('My Courses', d.course_count) + statCard('Pending Grading', d.pending_grading);
      extra.innerHTML = '';
    } else {
      grid.innerHTML = statCard('Enrolled Courses', d.course_count) + statCard('Average Grade', d.average_grade_pct !== null ? `${d.average_grade_pct.toFixed(1)}%` : '-');
      extra.innerHTML = '<h2>Due This Week</h2>' + (d.upcoming_assignments.length
        ? d.upcoming_assignments.map(a => `<div class="announcement">${escapeHtml(a.title)} -- ${escapeHtml(a.course_title)} (due ${new Date(a.due_date).toLocaleDateString()})</div>`).join('')
        : '<p class="muted">Nothing due in the next 7 days.</p>');
    }
  },

  async loadCourses() {
    const courses = await fetch('/api/courses').then(r => r.json());
    document.getElementById('courses-list').innerHTML = courses.map(c => `
      <div class="course-card" onclick="App.openCourse(${c.id})">
        <h3>${escapeHtml(c.title)}</h3>
        <p>${escapeHtml(c.description || '')}</p>
        <p class="muted">Teacher: ${escapeHtml(c.teacher_name || 'Unassigned')}</p>
      </div>
    `).join('') || '<p class="muted">No courses yet.</p>';
  },

  async createCourse() {
    const title = document.getElementById('new-course-title').value;
    const description = document.getElementById('new-course-desc').value;
    if (!title) return alert('Title is required.');
    const res = await fetch('/api/courses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, description }) });
    if (!res.ok) return alert((await res.json()).error);
    document.getElementById('new-course-title').value = '';
    document.getElementById('new-course-desc').value = '';
    this.loadCourses();
  },

  async openCourse(id) {
    const c = await fetch(`/api/courses/${id}`).then(r => r.json());
    this.currentCourse = c;
    document.getElementById('cd-title').textContent = c.title;
    document.getElementById('cd-description').textContent = c.description;

    const canManage = this.currentUser.role !== 'student';
    document.getElementById('cd-announcement-form').hidden = !canManage;
    document.getElementById('cd-new-assignment-form').hidden = !canManage;
    document.getElementById('cd-enroll-form').hidden = !canManage;

    document.getElementById('cd-announcements').innerHTML = c.announcements.map(a => `
      <div class="announcement">${escapeHtml(a.message)}<div class="meta">${escapeHtml(a.posted_by_name || 'Staff')} -- ${new Date(a.created_at).toLocaleString()}</div></div>
    `).join('') || '<p class="muted">No announcements yet.</p>';

    document.getElementById('cd-assignments-list').innerHTML = c.assignments.map(a => `
      <div class="assignment-row" onclick="App.openAssignment(${a.id}, '${escapeHtml(a.title).replace(/'/g, "\\'")}')">
        <span>${escapeHtml(a.title)}</span>
        <span class="muted">${a.due_date ? 'Due ' + new Date(a.due_date).toLocaleDateString() : 'No due date'} -- ${a.max_marks} pts</span>
      </div>
    `).join('') || '<p class="muted">No assignments yet.</p>';

    document.getElementById('cd-roster-body').innerHTML = c.roster.map(s => `<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.username)}</td></tr>`).join('') || '<tr><td colspan="2">No students enrolled.</td></tr>';

    this.showViewRaw('course-detail');
  },

  showViewRaw(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
  },

  async postAnnouncement() {
    const message = document.getElementById('cd-announcement-input').value;
    if (!message) return;
    await fetch(`/api/courses/${this.currentCourse.id}/announcements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
    document.getElementById('cd-announcement-input').value = '';
    this.openCourse(this.currentCourse.id);
  },

  async createAssignment() {
    const title = document.getElementById('cd-assign-title').value;
    const due_date = document.getElementById('cd-assign-due').value;
    const max_marks = document.getElementById('cd-assign-marks').value;
    if (!title) return alert('Title is required.');
    await fetch('/api/assignments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ course_id: this.currentCourse.id, title, due_date, max_marks }) });
    document.getElementById('cd-assign-title').value = '';
    this.openCourse(this.currentCourse.id);
  },

  async enrollStudent() {
    const username = document.getElementById('cd-enroll-username').value;
    if (!username) return;
    const res = await fetch(`/api/courses/${this.currentCourse.id}/enroll`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
    if (!res.ok) return alert((await res.json()).error);
    document.getElementById('cd-enroll-username').value = '';
    this.openCourse(this.currentCourse.id);
  },

  async openAssignment(id, title) {
    this.currentAssignment = { id, title };
    document.getElementById('ad-title').textContent = title;
    const isStudent = this.currentUser.role === 'student';
    document.getElementById('ad-submit-form').hidden = !isStudent;
    document.getElementById('ad-submissions-table').hidden = isStudent;

    if (!isStudent) {
      const rows = await fetch(`/api/assignments/${id}/submissions`).then(r => r.json());
      document.getElementById('ad-submissions-body').innerHTML = rows.map(r => `
        <tr>
          <td>${escapeHtml(r.student_name)}</td>
          <td>${r.submitted_at ? new Date(r.submitted_at).toLocaleString() : 'Not submitted'}</td>
          <td>${r.grade !== null ? r.grade : '-'}</td>
          <td>${escapeHtml(r.feedback || '-')}</td>
          <td>${r.submission_id ? `<button class="btn-sm" onclick="App.gradeSubmission(${r.submission_id})">Grade</button>` : ''}</td>
        </tr>
      `).join('');
    }
    this.showViewRaw('assignment-detail');
  },

  async submitAssignment() {
    const content = document.getElementById('ad-submission-content').value;
    if (!content) return alert('Write something before submitting.');
    await fetch(`/api/assignments/${this.currentAssignment.id}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
    alert('Submitted.');
  },

  async gradeSubmission(submissionId) {
    const grade = prompt('Grade (out of max marks):');
    if (grade === null) return;
    const feedback = prompt('Feedback (optional):') || '';
    await fetch(`/api/submissions/${submissionId}/grade`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grade, feedback }) });
    this.openAssignment(this.currentAssignment.id, this.currentAssignment.title);
  }
};

function statCard(label, value) {
  return `<div class="stat-card"><span class="stat-label">${escapeHtml(label)}</span><span class="stat-value">${value}</span></div>`;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

App.init();
