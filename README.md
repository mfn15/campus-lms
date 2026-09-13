# Campus LMS

A learning management system for schools and academies: courses, enrollments, assignments, submissions, grading, and announcements, with role-aware views for admins, teachers, and students.

## Features

- **Roles** -- admin (full oversight), teacher (manage own courses/assignments/grading), student (view enrolled courses, submit work, track grades).
- **Courses** -- create courses, enroll students by username, post announcements.
- **Assignments** -- due dates, max marks, and a submissions view that shows every enrolled student (including who *hasn't* submitted yet, not just who has).
- **Grading** -- teachers grade submissions with a score and feedback; students see their own grades and a running average across all courses.
- **Dashboards** -- role-specific: admin gets platform-wide counts, teachers see their course count and pending-grading queue, students see enrolled courses, average grade, and assignments due in the next 7 days.

## Tech stack

Node.js + Express, PostgreSQL (Supabase-ready), vanilla JS/CSS frontend.

## Getting started

```bash
npm install
cp .env.example .env
npm run db:seed   # 1 admin, 1 teacher, 2 students, 2 courses, 1 graded-in-progress assignment
npm start
```

Visit `http://localhost:4200`. Demo logins: `admin`/`admin123`, `teacher`/`teacher123`, `student1`/`student123` (or `student2`).

## Using Supabase

Set `DATABASE_URL` in `.env` to your Supabase connection string (the Transaction pooler string works well for serverless hosting), then run `npm run db:seed`.

## Project structure

```
database/   schema.sql, connection pool, seed script
routes/     auth, courses, assignments, submissions, dashboard
public/     static frontend (single-page app, vanilla JS)
server.js   Express app entry point
```
