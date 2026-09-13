require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

(async () => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const adminHash = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'admin123', 10);
    const teacherHash = await bcrypt.hash(process.env.DEFAULT_TEACHER_PASSWORD || 'teacher123', 10);
    const studentHash = await bcrypt.hash(process.env.DEFAULT_STUDENT_PASSWORD || 'student123', 10);

    await client.query(`INSERT INTO users(username,password,role,name,email) VALUES($1,$2,'admin','Academy Admin','admin@example.com') ON CONFLICT(username) DO NOTHING`, ['admin', adminHash]);
    const teacher = await client.query(`INSERT INTO users(username,password,role,name,email) VALUES($1,$2,'teacher','Ms. Rivera','rivera@example.com') ON CONFLICT(username) DO UPDATE SET name=EXCLUDED.name RETURNING id`, ['teacher', teacherHash]);
    const student1 = await client.query(`INSERT INTO users(username,password,role,name,email) VALUES($1,$2,'student','Alex Chen','alex@example.com') ON CONFLICT(username) DO UPDATE SET name=EXCLUDED.name RETURNING id`, ['student1', studentHash]);
    const student2 = await client.query(`INSERT INTO users(username,password,role,name,email) VALUES($1,$2,'student','Priya Kumar','priya@example.com') ON CONFLICT(username) DO UPDATE SET name=EXCLUDED.name RETURNING id`, ['student2', studentHash]);

    const course1 = await client.query(
      `INSERT INTO courses(title,description,teacher_id) VALUES($1,$2,$3) RETURNING id`,
      ['Introduction to Biology', 'Foundations of cell biology, genetics, and ecosystems.', teacher.rows[0].id]
    );
    const course2 = await client.query(
      `INSERT INTO courses(title,description,teacher_id) VALUES($1,$2,$3) RETURNING id`,
      ['Algebra I', 'Linear equations, functions, and introductory algebraic reasoning.', teacher.rows[0].id]
    );

    for (const studentId of [student1.rows[0].id, student2.rows[0].id]) {
      for (const courseId of [course1.rows[0].id, course2.rows[0].id]) {
        await client.query(`INSERT INTO enrollments(course_id,student_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, [courseId, studentId]);
      }
    }

    const assignment = await client.query(
      `INSERT INTO assignments(course_id,title,description,due_date,max_marks) VALUES($1,$2,$3,CURRENT_DATE + INTERVAL '7 days',100) RETURNING id`,
      [course1.rows[0].id, 'Cell Structure Report', 'Write a 500-word report on plant vs. animal cell structure.']
    );

    await client.query(
      `INSERT INTO submissions(assignment_id,student_id,content) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
      [assignment.rows[0].id, student1.rows[0].id, 'My report: plant cells have a cell wall and chloroplasts, animal cells do not...']
    );

    await client.query(
      `INSERT INTO announcements(course_id,message,posted_by) VALUES($1,$2,$3)`,
      [course1.rows[0].id, 'Welcome to Introduction to Biology! Please review the syllabus before our first session.', teacher.rows[0].id]
    );

    await client.query('COMMIT');
    console.log('Campus LMS demo data seeded successfully.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.end();
  }
})();
