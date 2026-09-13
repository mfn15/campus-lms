const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/', async (req, res) => {
  const u = req.session.user;
  try {
    if (u.role === 'admin') {
      const counts = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM courses) AS courses,
          (SELECT COUNT(*)::int FROM users WHERE role='student') AS students,
          (SELECT COUNT(*)::int FROM users WHERE role='teacher') AS teachers,
          (SELECT COUNT(*)::int FROM assignments) AS assignments
      `);
      return res.json({ role: 'admin', ...counts.rows[0] });
    }

    if (u.role === 'teacher') {
      const counts = await db.query(`SELECT COUNT(*)::int AS course_count FROM courses WHERE teacher_id=$1`, [u.id]);
      const pending = await db.query(
        `SELECT COUNT(*)::int AS pending_count FROM submissions s
         JOIN assignments a ON a.id = s.assignment_id
         JOIN courses c ON c.id = a.course_id
         WHERE c.teacher_id = $1 AND s.grade IS NULL`,
        [u.id]
      );
      return res.json({ role: 'teacher', course_count: counts.rows[0].course_count, pending_grading: pending.rows[0].pending_count });
    }

    // student
    const courseCount = await db.query(`SELECT COUNT(*)::int AS course_count FROM enrollments WHERE student_id=$1`, [u.id]);
    const upcoming = await db.query(
      `SELECT a.title, c.title AS course_title, a.due_date
       FROM assignments a
       JOIN enrollments e ON e.course_id = a.course_id
       JOIN courses c ON c.id = a.course_id
       WHERE e.student_id=$1 AND a.due_date >= CURRENT_DATE AND a.due_date <= CURRENT_DATE + INTERVAL '7 days'
       ORDER BY a.due_date`,
      [u.id]
    );
    const avgGrade = await db.query(
      `SELECT AVG(grade / max_marks * 100) AS pct FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE s.student_id=$1 AND s.grade IS NOT NULL`,
      [u.id]
    );
    res.json({
      role: 'student',
      course_count: courseCount.rows[0].course_count,
      upcoming_assignments: upcoming.rows,
      average_grade_pct: avgGrade.rows[0].pct !== null ? Number(avgGrade.rows[0].pct) : null
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
