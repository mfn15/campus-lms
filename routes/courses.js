const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Admin sees every course, a teacher sees the ones they teach, a student
// sees the ones they're enrolled in.
router.get('/', async (req, res) => {
  const u = req.session.user;
  try {
    let r;
    if (u.role === 'admin') {
      r = await db.query(`SELECT c.*, t.name AS teacher_name FROM courses c LEFT JOIN users t ON t.id=c.teacher_id ORDER BY c.title`);
    } else if (u.role === 'teacher') {
      r = await db.query(`SELECT c.*, t.name AS teacher_name FROM courses c LEFT JOIN users t ON t.id=c.teacher_id WHERE c.teacher_id=$1 ORDER BY c.title`, [u.id]);
    } else {
      r = await db.query(
        `SELECT c.*, t.name AS teacher_name FROM courses c
         LEFT JOIN users t ON t.id=c.teacher_id
         JOIN enrollments e ON e.course_id=c.id
         WHERE e.student_id=$1 ORDER BY c.title`,
        [u.id]
      );
    }
    res.json(r.rows.map(x => ({ ...x, id: Number(x.id) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  if (!['admin', 'teacher'].includes(req.session.user.role)) return res.status(403).json({ error: 'Not authorized.' });
  const { title, description } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title is required.' });
  try {
    const teacherId = req.session.user.role === 'teacher' ? req.session.user.id : (req.body.teacher_id || null);
    const r = await db.query(`INSERT INTO courses(title,description,teacher_id) VALUES($1,$2,$3) RETURNING id`, [title, description || '', teacherId]);
    res.json({ success: true, id: Number(r.rows[0].id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  const courseId = Number(req.params.id);
  try {
    const course = await db.query(`SELECT c.*, t.name AS teacher_name FROM courses c LEFT JOIN users t ON t.id=c.teacher_id WHERE c.id=$1`, [courseId]);
    if (!course.rowCount) return res.status(404).json({ error: 'Course not found.' });

    const roster = await db.query(
      `SELECT u.id, u.name, u.username FROM enrollments e JOIN users u ON u.id=e.student_id WHERE e.course_id=$1 ORDER BY u.name`,
      [courseId]
    );
    const assignments = await db.query(`SELECT * FROM assignments WHERE course_id=$1 ORDER BY due_date NULLS LAST`, [courseId]);
    const announcements = await db.query(
      `SELECT a.*, u.name AS posted_by_name FROM announcements a LEFT JOIN users u ON u.id=a.posted_by WHERE a.course_id=$1 ORDER BY a.created_at DESC`,
      [courseId]
    );

    res.json({
      ...course.rows[0],
      id: Number(course.rows[0].id),
      roster: roster.rows.map(x => ({ ...x, id: Number(x.id) })),
      assignments: assignments.rows.map(x => ({ ...x, id: Number(x.id), max_marks: Number(x.max_marks) })),
      announcements: announcements.rows.map(x => ({ ...x, id: Number(x.id) }))
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/enroll', async (req, res) => {
  if (!['admin', 'teacher'].includes(req.session.user.role)) return res.status(403).json({ error: 'Not authorized.' });
  const { username } = req.body || {};
  try {
    const student = await db.query(`SELECT id FROM users WHERE username=$1 AND role='student'`, [username]);
    if (!student.rowCount) return res.status(404).json({ error: 'No student found with that username.' });
    await db.query(`INSERT INTO enrollments(course_id,student_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, [Number(req.params.id), student.rows[0].id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/announcements', async (req, res) => {
  if (!['admin', 'teacher'].includes(req.session.user.role)) return res.status(403).json({ error: 'Not authorized.' });
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message is required.' });
  try {
    await db.query(`INSERT INTO announcements(course_id,message,posted_by) VALUES($1,$2,$3)`, [Number(req.params.id), message, req.session.user.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
