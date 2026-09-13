const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.post('/', async (req, res) => {
  if (!['admin', 'teacher'].includes(req.session.user.role)) return res.status(403).json({ error: 'Not authorized.' });
  const { course_id, title, description, due_date, max_marks } = req.body || {};
  if (!course_id || !title) return res.status(400).json({ error: 'course_id and title are required.' });
  try {
    const r = await db.query(
      `INSERT INTO assignments(course_id,title,description,due_date,max_marks) VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [Number(course_id), title, description || '', due_date || null, Number(max_marks) || 100]
    );
    res.json({ success: true, id: Number(r.rows[0].id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Submissions for one assignment, with each enrolled student's status --
// including students who haven't submitted yet, so a teacher can see who's
// missing, not just who's turned something in.
router.get('/:id/submissions', async (req, res) => {
  if (!['admin', 'teacher'].includes(req.session.user.role)) return res.status(403).json({ error: 'Not authorized.' });
  try {
    const r = await db.query(
      `SELECT u.id AS student_id, u.name AS student_name, s.id AS submission_id, s.content, s.submitted_at, s.grade, s.feedback
       FROM assignments a
       JOIN enrollments e ON e.course_id = a.course_id
       JOIN users u ON u.id = e.student_id
       LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = u.id
       WHERE a.id = $1
       ORDER BY u.name`,
      [Number(req.params.id)]
    );
    res.json(r.rows.map(x => ({ ...x, student_id: Number(x.student_id), submission_id: x.submission_id ? Number(x.submission_id) : null, grade: x.grade !== null ? Number(x.grade) : null })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// A student submits or updates their own submission for an assignment.
router.post('/:id/submit', async (req, res) => {
  if (req.session.user.role !== 'student') return res.status(403).json({ error: 'Only students can submit.' });
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'content is required.' });
  try {
    await db.query(
      `INSERT INTO submissions(assignment_id,student_id,content,submitted_at)
       VALUES($1,$2,$3,NOW())
       ON CONFLICT(assignment_id,student_id) DO UPDATE SET content=EXCLUDED.content, submitted_at=NOW(), grade=NULL, feedback=NULL, graded_at=NULL`,
      [Number(req.params.id), req.session.user.id, content]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
