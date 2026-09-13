const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.post('/:id/grade', async (req, res) => {
  if (!['admin', 'teacher'].includes(req.session.user.role)) return res.status(403).json({ error: 'Not authorized.' });
  const { grade, feedback } = req.body || {};
  if (grade === undefined || grade === null) return res.status(400).json({ error: 'grade is required.' });
  try {
    const r = await db.query(
      `UPDATE submissions SET grade=$1, feedback=$2, graded_at=NOW() WHERE id=$3 RETURNING id`,
      [Number(grade), feedback || null, Number(req.params.id)]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Submission not found.' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// A student's own grades across every course they're enrolled in.
router.get('/mine', async (req, res) => {
  if (req.session.user.role !== 'student') return res.status(403).json({ error: 'Not authorized.' });
  try {
    const r = await db.query(
      `SELECT a.title AS assignment_title, c.title AS course_title, s.grade, a.max_marks, s.feedback, s.submitted_at
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       JOIN courses c ON c.id = a.course_id
       WHERE s.student_id = $1
       ORDER BY s.submitted_at DESC`,
      [req.session.user.id]
    );
    res.json(r.rows.map(x => ({ ...x, grade: x.grade !== null ? Number(x.grade) : null, max_marks: Number(x.max_marks) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
