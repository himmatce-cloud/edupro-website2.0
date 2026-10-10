# EduPro deploy checklist
Env vars (Vercel -> Settings -> Environment Variables):
- OPENAI_API_KEY, CRON_SECRET  (question generator)
- AUTH_SECRET   (random 32+ chars; signs login cookies)
- ADMIN_MOBILE  (your 10-digit mobile; register it once with ADMIN_PIN)
- ADMIN_PIN     (secret admin PIN; never put it in HTML)
- Storage -> create a Blob store and connect it (adds BLOB_READ_WRITE_TOKEN)

Files: copy everything in this folder into the project root (api/ folder, *.html, edu-auth.js, my_qr.png, vercel.json, package.json).
Seed questions: call  GET /api/cron/generate  with header  Authorization: Bearer <CRON_SECRET>  repeatedly (free: cron-job.org every 10 min) until the response shows streamsReady: 20/20.
Payments: students pay by UPI QR (9166603971@ibl) and submit UTR; admin approves in admin-approvals.html after checking the UPI app. Change ADMIN PIN anytime by editing the env var.

## Update 2: NEET + Dashboard + Referral
- NEET: the 100 built-in questions were checked (facts OK) and their options are now shuffled so answers are not in an A-B-C-D cycle. When /api/questions has a ready pool for stream 6, the generated NEET questions replace them automatically.
- Dashboard: name, student ID, pass status/expiry, streak, today's minutes, questions solved, accuracy and recent tests all come from the server (/api/result). All 20 streams are selectable; links open test-series.html?stream=<id>.
- Referral: every user gets a code (EDU-XXXXXX). A new student enters it on the register form. When admin approves that student's payment, the referrer (if their pass is active) gets +1 paid referral; every 5th adds 30 days.

## Update 3: categories / books
- api/_lib/config.js now lists, for every part: subject + standard reference book(s) + syllabus chapters. The generator rotates through those chapters so the whole syllabus is covered.
- Stream 17 is now national General Studies (Polity, History & Culture, Geography, Economy & Science) - no state-specific facts.
- Streams 2 and 3 now have Physics, Chemistry and Biology/Maths parts (full board paper).
- Stream 8 (Civil): Structural Analysis & RCC (IS 456), Soil & Foundation, Surveying, Estimating/Costing (IS 1200).
- New: /api/report - students can report a wrong question after the test; 3 different reports remove it from the pool.
