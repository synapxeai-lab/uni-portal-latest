# Manual end-to-end test plan (live site)

Test the portal module by module, **in this order**: each module creates what the next one needs (diploma → courses → people → offerings → registration → classwork → marks → grades). Every step that needs data tells you exactly what to type at that point.

All the data is for a new programme, **Event Management**, with one diploma, **Diploma in Event Management (DEM)**, in the existing **2026** batch, plus its own teachers and students. It looks like real institute data, but none of it overlaps with anything already in the portal, so it's easy to find and remove afterwards (see **Cleanup** at the end). The portal sends no emails, so the `@eithm.edu.pk` addresses below are safe to use.

**How students move through the portal:** a student belongs to a programme and a batch (intake year). Each semester the portal places them in that programme's diploma for that semester (batch 2026 → Fall 2026 = semester 1). That's why DEM gets its own programme: as semester 1 of Event Management, its courses are what the test students see this term.

Report a failure by its ID, e.g. "M8-3 failed: …". **Edge** marks an edge case: a wrong input, a limit, or something that should **not** be allowed.

## Before you start

- Keep three windows open at once (a normal window, a private window and a second browser), signed in as **admin**, **teacher** and **student**, so you can see one role's action reach another without signing out. You'll sign in as the new teacher and student once M3 creates them.
- Keep a note of the **temporary passwords** the portal shows when you create people in M3. You need them in M1-10.
- Dates below are relative to the day you test ("today", "7 days from now"), so they always work.
- Do the phone checks in M19 on a phone or a narrow browser window.

| Module | Area | Main role |
|---|---|---|
| M1 | Sign-in, passwords, lockout | All |
| M2 | Programme, diploma, courses, sections | Admin |
| M3 | Teachers, students, users, view password | Admin |
| M4 | Offer courses, assign teachers | Admin |
| M5 | Registration window and student registration | Admin, Student |
| M6 | Classes page and classroom people | All |
| M7 | Stream | Teacher, Student |
| M8 | Classwork | Teacher |
| M9 | Submissions, To review, grading | Student, Teacher |
| M10 | Marks and the marksheet | Teacher, Admin, Student |
| M11 | Attendance | All three |
| M12 | Grades and transcript | All three |
| M13 | Fees | Admin, Student |
| M14 | Timetable and clashes | All three |
| M15 | Calendar and To-do | All |
| M16 | Notifications | All |
| M17 | Search | All |
| M18 | Settings, profile, archived classes | All |
| M19 | Dashboards, sidebar, permissions, phone layout | All |
| M20 | Audit logs | Admin |

---

## M1. Sign-in and account security

Start with the admin account; you'll repeat M1-10 to M1-13 with the new teacher and student after M3.

- [ ] **M1-1** Sign in as admin → lands on the Dashboard with the admin sidebar.
- [ ] **M1-2** Sign out → login page; pressing Back doesn't show the portal.
- [ ] **M1-3** Sign in again and refresh the page → still signed in.
- [ ] **M1-4** In a private window, open `/dashboard` without signing in → sent to the login page.
- [ ] **M1-5** **Edge** Admin email with password `Wrong@123` → "Incorrect email or password."
- [ ] **M1-6** **Edge** Email `nobody@eithm.edu.pk`, any password → the same "Incorrect email or password." (it never says the email doesn't exist).
- [ ] **M1-7** **Edge** Leave email empty; then try email `admin@` → field errors, nothing submitted.
- [ ] **M1-8** **Edge** Admin email typed in capitals (`ADMIN@EITHM.EDU.PK`) with the right password → signs in.
- [ ] **M1-9** **Edge** *(do this after M3, on Daniyal Shah's account, not the admin's)* Enter the wrong password `Wrong@123` repeatedly:
  - tries 1–2 → "Incorrect email or password."
  - tries 3, 4, 5, 6, 7 → "Incorrect email or password. **5 / 4 / 3 / 2 / 1 attempt(s) left** before your account is locked."
  - try 8 → "**Your account is locked** after too many wrong passwords. Please contact the administrator to unlock it."
  - the right password now → the same locked message.

  As admin, Users → set Daniyal back to **Active** → one more wrong password just says "Incorrect email or password." (the count starts again), and the right password signs him in.
- [ ] **M1-9b** **Edge** Admins are never locked: type the admin's password wrong 10 times → always "Incorrect email or password." (no warnings, no lock); the right password then signs in.
- [ ] **M1-9a** **Edge** An email that doesn't exist, tried 10 times → always "Incorrect email or password." (never "locked" or "attempts left").
- [ ] **M1-10** *(after M3)* Sign in as **Sadia Rehman** (`sadia.rehman@eithm.edu.pk`) with her temporary password → forced to Change password; no other page opens until she changes it.
- [ ] **M1-11** **Edge** On Change password, current password `Wrong@123` → "Current password is incorrect."
- [ ] **M1-12** **Edge** New password `Sadia@2027`, confirm `Sadia@2028` → mismatch error; new password `123` → too short.
- [ ] **M1-13** Current = temporary password, new and confirm = **`Sadia@2027`** → saved. Sign out and back in with `Sadia@2027` → works; the temporary one is refused.
- [ ] **M1-14** **Edge** *(after M3-15)* A deactivated user tries to sign in → refused.

## M2. Academic structure (admin)

**M2-A. Programme and diploma** (Academics → Programmes)

- [ ] **M2-1** The Programmes page lists every programme with its diplomas.
- [ ] **M2-1a** Create a main programme:

  | Field | Value |
  |---|---|
  | Name | Event Management |
  | Description | Diplomas in planning and running corporate, social and cultural events. |

  → it appears on the Programmes page (and later as a pill on the Classes page). **Edge** create it again with the same name → "A main programme with this name already exists."
- [ ] **M2-2** Open **Event Management** → add a diploma with:

  | Field | Value |
  |---|---|
  | Name | Diploma in Event Management |
  | Code | DEM |
  | Head of department | Ms. Rabia Anwar |
  | Description | Planning, marketing and running corporate, social and cultural events. |
  | Colour | any |

  → it appears under Event Management as **Semester 1** (the first diploma of a programme is semester 1).
- [ ] **M2-3** **Edge** Create another diploma with name `Diploma in Event Management` or code `DEM` → "A diploma with this name or code already exists."
- [ ] **M2-4** **Edge** Try to save a diploma with an empty name, or the name `D` → "Name must be at least 2 characters"; nothing saved.
- [ ] **M2-5** Edit the DEM description to `Planning and running corporate, social and cultural events.` → saved.

**M2-B. Courses** (Academics → Courses → add course, diploma = Diploma in Event Management)

- [ ] **M2-6** Create these three courses:

  | Code | Name | Credit hours | Fee (Rs.) | Discount % |
  |---|---|---|---|---|
  | DEM-101 | Principles of Event Management | 3 | 18000 | 0 |
  | DEM-102 | Venue Operations and Logistics | 3 | 18000 | 10 |
  | DEM-103 | Event Marketing and Sponsorship | 2 | 12000 | 0 |

  Then open DEM-101 → add an extra fee **Practical lab charges**, amount **2500**.
- [ ] **M2-7** **Edge** Create another course with code `DEM-101` in the same diploma → "A course with this code already exists in that diploma."
- [ ] **M2-8** **Edge** Credit hours `0`, `-3`, `101`, `2.5` → "at least 1" / "at most 100" / whole number only.
- [ ] **M2-9** **Edge** Fee `-1` → "Fee cannot be negative"; `1500.75` → whole number; discount `150` → "cannot be more than 100%".
- [ ] **M2-10** Open DEM-101 → details, extra fee and assessment scheme section are shown.
- [ ] **M2-11** Rename DEM-103 to `Event Marketing and Sponsorships`, then back to `Event Marketing and Sponsorship` → shows the new name each time.

**M2-C. Sections in batch 2026** (Academics → Batches → 2026)

Batch **2026** already exists and your real students are in it; you're only adding DEM sections to it. Don't rename or delete batch 2026.

- [ ] **M2-12** In batch **2026**, add sections **A** and **B** for **Diploma in Event Management**.
- [ ] **M2-13** The Batches page shows batch 2026 with the DEM sections (0 students for now); the other diplomas' sections are unchanged.
- [ ] **M2-14** Add one more section → it gets the next letter (**C**).
- [ ] **M2-15** **Edge** In the *create batch* form (don't save): batch name `2027_A` → "letters, numbers, spaces or hyphens only"; name `2026` with year `2027` → "A batch named after a year must use that year"; year `1999` → "Enter a valid year".
- [ ] **M2-16** **Edge** Delete section C while it's empty → deleted. (Later, after M3, try deleting section A, which has students → it must refuse or warn, never silently drop students.)

## M3. People (admin)

**M3-A. Teachers** (People → Teachers → add teacher)

- [ ] **M3-1** Create two teachers. Note each temporary password shown after saving.

  | Field | Teacher 1 | Teacher 2 |
  |---|---|---|
  | Name | Ms. Sadia Rehman | Mr. Kamran Qureshi |
  | Email | sadia.rehman@eithm.edu.pk | kamran.qureshi@eithm.edu.pk |
  | Phone | 0300-4417285 | 0321-6648120 |
  | CNIC | 35202-4471852-6 | 35201-8823417-1 |
  | Address | House 14, Block C, Johar Town, Lahore | Flat 6, Gulberg III, Lahore |
  | Qualification | MBA (Hospitality Management) | MSc Tourism and Hospitality |
  | Programme | Event Management | Event Management |
  | Type | Visiting | Permanent |
  | Pay | Rate per credit hour **2500** | Salary **95000** |
  | Guardian name | Abdul Rehman | Javed Qureshi |
  | Guardian contact | 0300-4417290 | 0321-6648133 |
  | Guardian CNIC | 35202-1129384-5 | 35201-3349182-7 |

- [ ] **M3-2** **Edge** Add a third teacher with email `sadia.rehman@eithm.edu.pk` (or CNIC `35202-4471852-6`) → "A teacher with this email or CNIC already exists."
- [ ] **M3-3** **Edge** CNIC `3520244718526` (no dashes) or `35202-447185-6` → "CNIC must be in format 12345-1234567-1"; email `sadia.rehman@` → "Invalid email address". Cancel without saving.
- [ ] **M3-4** Open Ms. Sadia Rehman's page → profile shown, no courses yet.

**M3-B. Students** (People → Students → add student)

- [ ] **M3-5** Create three students. Note each temporary password.

  | Field | Student 1 | Student 2 | Student 3 |
  |---|---|---|---|
  | Name | Ahsan Mehmood | Mahnoor Tariq | Daniyal Shah |
  | Roll no | EITHM-26-EM-001 | EITHM-26-EM-002 | EITHM-26-EM-003 |
  | Email | ahsan.mehmood@eithm.edu.pk | mahnoor.tariq@eithm.edu.pk | daniyal.shah@eithm.edu.pk |
  | Phone | 0312-5583012 | 0333-7720419 | 0345-2296753 |
  | CNIC | 35202-6638104-3 | 35201-9047712-4 | 35202-3315578-9 |
  | Date of birth | 2006-03-15 | 2005-11-02 | 2006-07-21 |
  | Gender | Male | Female | Male |
  | Address | House 22, Model Town, Lahore | House 9, DHA Phase 5, Lahore | Street 4, Wapda Town, Lahore |
  | Last qualification | Intermediate (FA) | Intermediate (ICS) | A-Levels |
  | Passing year | 2025 | 2025 | 2026 |
  | Grade | A | B | A |
  | Board / university | BISE Lahore | BISE Lahore | Cambridge International |
  | Programme | Event Management | same | same |
  | Batch / section | 2026 / A | 2026 / B | 2026 / A |
  | Guardian name | Mehmood Akhtar | Tariq Mahmood | Asif Shah |
  | Relationship | Father | Father | Father |
  | Guardian contact | 0300-5583020 | 0333-7720400 | 0345-2296700 |
  | Guardian CNIC | 35202-1184420-1 | 35201-2093316-5 | 35202-7740219-3 |
  | Guardian email | mehmood.akhtar@gmail.com | tariq.mahmood@gmail.com | asif.shah@gmail.com |

- [ ] **M3-6** **Edge** Add a student with roll no `EITHM-26-EM-001` (or Ahsan's email / CNIC) → "A student with this email, CNIC, or roll number already exists."
- [ ] **M3-7** **Edge** Date of birth = tomorrow → "Enter a valid date of birth"; passing year `1949` or `2030` → "Enter a valid passing year". Cancel.
- [ ] **M3-8** Move **Mahnoor Tariq** from section B to **A**, then back to **B** → she shows in the right section each time.
- [ ] **M3-9** **Edge** Move Mahnoor to B while she's already in B → "Student is already in this section."
- [ ] **M3-10** Students page filters: programme Event Management → diploma DEM → batch 2026 → section A shows Ahsan and Daniyal; searching `EM-002` shows Mahnoor.

**M3-C. Users** (People → Users)

- [ ] **M3-11** Filter role = Student, search `ahsan` → Ahsan Mehmood is listed, status Active.
- [ ] **M3-12** **View password** on Ms. Sadia Rehman (after she changed it in M1-13) → shows **`Sadia@2027`**.
- [ ] **M3-13** **Change password** on Mahnoor Tariq: a too-short password is refused with the policy message; set **`Mahnoor@2027`** → she signs in with it straight away, with no forced change.
- [ ] **M3-14** The Users page menu has no Suspend, Force password change or Archive options; it has **Delete user** (not on your own account).
- [ ] **M3-15** **Deactivate** Daniyal Shah → he can't sign in (M1-14); **Reactivate** him → he can.
- [ ] **M3-16** **Edge** On your own admin row: changing your role / locking yourself is refused or disabled.

Now go back and do **M1-9 to M1-14** with these accounts. From here on, use **Ms. Sadia Rehman** as "the teacher" and **Ahsan Mehmood** as "the student".

## M4. Offer courses and assign teachers (admin)

- [ ] **M4-1** Academics → Offer courses → Diploma in Event Management, batch 2026 → offer:

  | Course | Sections |
  |---|---|
  | DEM-101 | A and B |
  | DEM-102 | A |
  | DEM-103 | A |

  → each offering gets a classroom.
- [ ] **M4-2** **Edge** Try to offer a course from another programme (e.g. a Culinary course) to DEM 2026 A → refused.
- [ ] **M4-3** Academics → Assign teachers → for **DEM-101 · 2026 A** pick **Ms. Sadia Rehman** → a confirmation popup appears. Click **Cancel** → dropdown still says Not assigned.
- [ ] **M4-4** Pick her again → **Assign teacher** → saved. Assign the rest:

  | Course · section | Teacher |
  |---|---|
  | DEM-101 · 2026 A | Ms. Sadia Rehman |
  | DEM-101 · 2026 B | Ms. Sadia Rehman |
  | DEM-102 · 2026 A | Mr. Kamran Qureshi |
  | DEM-103 · 2026 A | leave **Not assigned** |

- [ ] **M4-5** Change DEM-101 · 2026 B to Mr. Kamran Qureshi → popup says "Replace Ms. Sadia Rehman with Mr. Kamran Qureshi"; confirm. Then change it back to Ms. Sadia Rehman.
- [ ] **M4-6** Set DEM-102 · 2026 A to Not assigned → red "Remove teacher" popup; **Cancel** (keep Mr. Kamran Qureshi).
- [ ] **M4-7** Programme filter = Event Management, diploma = DEM → only the DEM rows.
- [ ] **M4-8** Admin dashboard: **Teachers to be assigned** includes DEM-103 · 2026 A.
- [ ] **M4-9** **Edge** *(after M5)* Try to un-offer DEM-101 · 2026 A, which now has registrations → refused or warned.

## M5. Registration

**M5-A. Admin: open registration** (Academics → Registration)

- [ ] **M5-1** A Fall 2026 registration window should already be open; if so, use it and skip to M5-2. Otherwise start one: semester **Fall** (or the current one), start **today**, end **14 days from today**, semester start **today**, semester end **4 months from today** → every dashboard shows "Registration open".
- [ ] **M5-2** **Note batch 2026's current credit limit first** (your real students share it). Set it to **6** for M5-5 to M5-7, then **put the original limit back** right after M5-7.
- [ ] **M5-3** **Edge** In the start form (don't save), end date before start date → "End date must be after the start date"; credit limit `0` → "at least 1"; `101` → "too high". Don't save.

**M5-B. Student: register** (as Ahsan Mehmood → Registration)

- [ ] **M5-4** The list shows only DEM courses offered to batch 2026 section A: DEM-101, DEM-102, DEM-103.
- [ ] **M5-5** Register **DEM-101** and **DEM-102** (3 + 3 = 6 credits, exactly the limit) → both under My courses; Ahsan is now in both classrooms (Classes page).
- [ ] **M5-6** **Edge** Register DEM-101 again → "You are already registered for this course."
- [ ] **M5-7** **Edge** Also add DEM-103 (would be 8 credits) → refused for going over the 6-credit limit.
- [ ] **M5-8** As **Daniyal Shah**, register DEM-101 and DEM-103 (5 credits). As **Mahnoor Tariq** (section B), the list shows only DEM-101 (offered to B); register it.
- [ ] **M5-9** As Daniyal, drop DEM-103 → removed from My courses and from its classroom. Register it again.
- [ ] **M5-10** Admin → Registration shows who registered what.
- [ ] **M5-11** **Edge** ~~End the registration window~~ — **don't do this on the live site**: it closes registration for every real student. Test it locally instead (students then see "Registration is not currently open").

## M6. Classes and classroom people

- [ ] **M6-1** Classes page: Ms. Sadia Rehman sees DEM-101 A and B; Ahsan sees DEM-101 A and DEM-102 A; admin sees all classes.
- [ ] **M6-2** Admin & teacher: Programme pills list every programme (some with 0); counts add up to "All".
- [ ] **M6-3** As admin: pill **Event Management** → Diploma DEM → Batch 2026 → Section A → only the DEM section A classes. Change Diploma → Batch and Section reset to All.
- [ ] **M6-4** As Ms. Sadia Rehman there's **no Teacher dropdown**; as admin there is (pick Ms. Sadia Rehman → only her classes).
- [ ] **M6-5** Cards sit under the heading "DEM · Diploma in Event Management" with a count.
- [ ] **M6-6** Search `DEM-102` → only that class; "Showing 1 of …"; Clear filters → all back.
- [ ] **M6-7** **Edge** Search `zzz` → "No classes match these filters".
- [ ] **M6-8** **Edge** Set filters, refresh the page, then press Back → filters are kept.
- [ ] **M6-9** As Ms. Sadia Rehman, create a class by hand: name **Event Management Study Circle**, section **Evening** → appears under "Other classes". Note its class code.
- [ ] **M6-10** As Mahnoor Tariq, Join class with that code → joined. **Edge** code `abc12` → "Class codes are 6-8 characters."; `zzzzzz` → "No class was found with that code."
- [ ] **M6-11** DEM-101 A → People tab: Ms. Sadia Rehman as teacher; Ahsan and Daniyal as students (they never joined; registration added them).
- [ ] **M6-12** **Edge** In Event Management Study Circle, Ms. Sadia Rehman tries to remove herself (the only teacher) → "Every class needs at least one teacher"; tries Leave class → "Classroom owners can't leave their own class. Archive it instead."

## M7. Stream (DEM-101 · 2026 A)

- [ ] **M7-1** As Ms. Sadia Rehman, post:
  > Welcome to Principles of Event Management! Please read the course outline before our first class on Monday. Bring a notebook for the planning exercises.

  Attach a small PDF (any course outline). → Ahsan's window shows it **without refreshing** (within a few seconds), with a **New** badge.
- [ ] **M7-2** Ahsan opens the attached PDF → it opens / downloads.
- [ ] **M7-3** **Edge** Post an empty announcement → "Announcement can't be empty."
- [ ] **M7-4** **Edge** Attach a file over 25 MB (any large video) → refused.
- [ ] **M7-5** Save as draft: `Reminder: guest speaker session next Friday at 11:00.` → Ahsan can't see it. Then post it → he sees it.
- [ ] **M7-6** Schedule for **3 minutes from now**: `Quiz 1 will be held in next week's class.` → appears for Ahsan at that time.
- [ ] **M7-7** Edit the welcome post (add "See you in Room 101.") → shows "edited". Pin it → stays on top above newer posts.
- [ ] **M7-8** Ahsan comments `Thank you, Ma'am. Will the outline be covered in the quiz?`; Ms. Sadia Rehman replies `Yes, chapters 1 and 2.` → both see each other's comments live.
- [ ] **M7-9** **Edge** Empty comment → refused.
- [ ] **M7-10** Ahsan deletes his own comment → gone. **Edge** Ahsan has no delete option on the teacher's comment; Ms. Sadia Rehman can delete any comment.
- [ ] **M7-11** After M8-2 and M8-6: Ahsan's stream shows "Ms. Sadia Rehman posted a new assignment: Event Concept Proposal" with due date and points, and a material post; clicking opens them.
- [ ] **M7-12** Ms. Sadia Rehman's own stream does **not** show those "posted a new …" cards.
- [ ] **M7-13** **Edge** The scheduled assignment from M8-5 doesn't appear in Ahsan's stream until it publishes.

## M8. Classwork (Ms. Sadia Rehman, DEM-101 · 2026 A)

- [ ] **M8-1** Create topics **Week 1 - Introduction to Events** and **Week 2 - Planning Process**; drag Week 2 above Week 1, refresh → order kept; put them back.
- [ ] **M8-2** Create an assignment under Week 1:

  | Field | Value |
  |---|---|
  | Title | Event Concept Proposal |
  | Instructions | Propose a 200-guest corporate dinner: theme, venue, rough budget and timeline (2 pages). |
  | Points | 10 |
  | Due | 7 days from now, 11:59 PM |
  | Marks category | Assignment |
  | Weightage | 5 |
  | Attachment | a small PDF (e.g. a proposal template) |

  → Publish. Ahsan sees it on Classwork.
- [ ] **M8-3** **Edge** Due date yesterday → "Due date must be in the future."; points `-5`, `7.5` or `100001` → refused.
- [ ] **M8-4** Create **Reading: Types of Events** with **no points**, due 3 days from now, **Save as draft** → Ahsan can't see it; then publish it → he can.
- [ ] **M8-5** Create **Venue Checklist** (points 10, no marks category), **schedule** it for **3 minutes from now**, due 5 days from now → appears for Ahsan at that time. **Edge** set its due date *before* the publish time → "Due date must be after the scheduled publish time."
- [ ] **M8-6** Create two materials under Week 1:
  - **Event Management Overview** — link `https://en.wikipedia.org/wiki/Event_management`
  - **Week 1 Slides** — attach a small PDF or PPTX

  → Ahsan sees both; clicking the material's stream post scrolls to it on Classwork and outlines it.
- [ ] **M8-7** Create a digital quiz: **Online Quiz 1 - Event Types**, points **20**, due 2 days from now, category **Quiz**, weightage **5** → publish.
- [ ] **M8-8** Edit Event Concept Proposal: due date one day later → Ahsan sees the new date.
- [ ] **M8-9** Close **Venue Checklist** → students can no longer submit. **Edge** closing a draft → "Only published assignments can be closed."
- [ ] **M8-10** Delete **Reading: Types of Events** → gone from Classwork and the stream.
- [ ] **M8-11** **Edge** As admin, open DEM-101 A → can view; trying to turn in work → "Admins cannot submit assignments."

## M9. Submissions and grading

- [ ] **M9-1** As Ahsan, open Event Concept Proposal → attach a small PDF/DOCX (e.g. `Ahsan_Event_Proposal.pdf`) → **Turn in** → status Turned in.
- [ ] **M9-2** Unsubmit → attach a revised file → turn in again → works.
- [ ] **M9-3** As Daniyal, turn in Online Quiz 1 with any file.
- [ ] **M9-4** **Edge** As Ms. Sadia Rehman, try to turn in work → "Teachers cannot submit assignments."
- [ ] **M9-5** Ms. Sadia Rehman → **To review**: both submissions are listed; filter Submitted, then Late, then Graded.
- [ ] **M9-6** Grade Ahsan's proposal **8 / 10** with feedback `Good theme and timeline. Add a cost breakdown for catering and decor.` → Ahsan sees grade and feedback.
- [ ] **M9-7** **Edge** Grade `11`, `-1` or `7.5` → refused.
- [ ] **M9-8** Grade Daniyal's quiz **15 / 20**. Then return it for revision → Daniyal sees "Returned for revision" and can resubmit. **Edge** returning work that isn't turned in → refused.
- [ ] **M9-9** **Edge** As Ahsan, try to unsubmit the already-graded proposal → refused.
- [ ] **M9-10** The assignment's Submissions page shows the right turned in / missing / graded counts.
- [ ] **M9-11** **Edge** As admin there's no **To review** in the sidebar; opening `/review` directly sends you back to the dashboard.

## M10. Marks (DEM-101 · 2026 A)

**Scheme** (admin, Academics → Courses → DEM-101 → assessment scheme)

- [ ] **M10-1** Set: **Quiz 15, Assignment 15, Mid 30, Final 40** (total 100) → saved.
- [ ] **M10-2** **Edge** Change Final to 50 (total 110) → refused or warned. Put it back to 40.

**Physical items** (Ms. Sadia Rehman → Marks → DEM-101 · 2026 A)

- [ ] **M10-3** Add a Quiz item **Quiz 1 (written)**, total **10**, weightage **5** → a column for every student.
- [ ] **M10-4** **Edge** Add another Quiz item **Quiz 2 (written)** with weightage **15** (5 + 5 online + 15 = 25 > 15) → refused.
- [ ] **M10-5** Enter marks: Ahsan **7**, Daniyal **9** → saved. **Edge** `11` or `-2` → refused.
- [ ] **M10-6** Ahsan → **Marks** page: shows Quiz 1 (written) 7/10 and its weightage.

**Classwork on the marksheet**

- [ ] **M10-7** The marksheet already shows **Event Concept Proposal** (Assignment, weightage 5) and **Online Quiz 1** (Quiz, weightage 5), created automatically in M8.
- [ ] **M10-8** Ahsan's 8/10 from M9-6 is filled in automatically; Daniyal's 15/20 shows on the quiz.
- [ ] **M10-9** Edit Event Concept Proposal points from 10 to **20** → the item's total becomes 20 and Ahsan's mark rescales (8/10 → 16/20).
- [ ] **M10-10** **Edge** Edit Online Quiz 1 weightage to **10** (5 + 10 = 15, OK) then **11** (16 > 15) → the second is refused. Set it back to 5.
- [ ] **M10-11** **Edge** A weightage with no category → "Pick a marks category for the weightage to count in."; a category with no points → "Give the assignment points to put it on the marksheet."
- [ ] **M10-12** **Edge** Venue Checklist (no marks category) is not on the marksheet.
- [ ] **M10-13** **Edge** Classwork items have no delete button on the marksheet.
- [ ] **M10-14** Create **Mid-Term Practical Exam** (digital): points **30**, category **Mid**, weightage **30** → appears under Mid.
- [ ] **M10-15** **Edge** As admin, lower DEM-101's Quiz category from 15 to **5** (its items already carry 10) → refused.
- [ ] **M10-16** **Edge** As Mr. Kamran Qureshi, open DEM-101 · 2026 A marks → "You are not assigned to teach this section."

## M11. Attendance

- [ ] **M11-1** Ms. Sadia Rehman → Attendance → DEM-101 · 2026 A → take today: **Mark all present**, then mark **Daniyal Absent** → save.
- [ ] **M11-2** Reopen today → change Daniyal to Present → saved.
- [ ] **M11-3** Ahsan → Attendance: DEM-101 shows 100%; opening it lists today as Present.
- [ ] **M11-4** Admin → Assessment → Attendance → **Edit attendance** → Diploma DEM → Section 2026 A → Course DEM-101 → today's date is listed with the Present/Absent counts.
- [ ] **M11-5** Open the day → search roll no `EM-003` → Daniyal only → set Absent → save → Daniyal's own page shows Absent.
- [ ] **M11-6** **Edge** The admin can't add a new day (only days the teacher took are listed).
- [ ] **M11-7** **Edge** Mahnoor (section B) isn't in the section A list.
- [ ] **M11-8** **Edge** Ms. Sadia Rehman tries a Sunday or a future date → refused.

## M12. Grades and transcript

- [ ] **M12-1** Ms. Sadia Rehman → Grades → DEM-101 · 2026 A → **Generate** → Ahsan and Daniyal get letter grades from their weighted percentages.
- [ ] **M12-2** **Edge** Before releasing, Ahsan's Marks / Transcript pages don't show the grade.
- [ ] **M12-3** Override Daniyal's grade to **B+** → shows as overridden.
- [ ] **M12-4** **Edge** Grade ranges that overlap (e.g. A from 80, A- from 85) → refused.
- [ ] **M12-5** **Release** → Ahsan sees his grade; Transcript shows DEM-101, credit hours and GPA.
- [ ] **M12-6** Admin → Grades shows DEM-101 · 2026 A as released.
- [ ] **M12-7** **Edge** Try releasing DEM-102 · 2026 A before generating → "No grades have been generated for this course."

## M13. Fees

- [ ] **M13-1** Ahsan → **Fee challan**: a challan for his registered courses. Expected total: DEM-101 18,000 + lab 2,500 + DEM-102 18,000 − 10% (1,800) = **Rs. 36,700**. If it differs, note what the portal shows.
- [ ] **M13-2** Ahsan marks it paid → "Awaiting approval". **Edge** pay again → "This challan is already awaiting approval."
- [ ] **M13-3** Admin → Fees: status dropdown defaults to **All statuses**; filter **Awaiting approval** → Ahsan's challan; search `Ahsan` finds it.
- [ ] **M13-4** Approve → Ahsan sees Paid; dashboard **Awaiting approval payments** drops by one.
- [ ] **M13-5** **Edge** Approve it again → "Only challans awaiting approval can be approved."
- [ ] **M13-6** Teachers' pay tab: **Assigned** is selected by default and shows Ms. Sadia Rehman (2 sections × 3 credits × Rs. 2,500) and Mr. Kamran Qureshi; Unassigned / All pills switch the list.

## M14. Timetable and clashes

- [ ] **M14-1** Ms. Sadia Rehman → Timetable → schedule **DEM-101 · 2026 A**, **Monday 09:00**, room **101** → shows for her and for Ahsan.
- [ ] **M14-2** **Edge** Sunday → "Classes run Monday to Saturday."; empty room → "Enter the room number."
- [ ] **M14-3** Move it to **Monday 10:00** → Ahsan's timetable updates without refreshing; move it back to 09:00.
- [ ] **M14-4** **Edge** Mr. Kamran Qureshi schedules **DEM-102 · 2026 A**, **Monday 09:00**, room **102** (same section, same hour) → a clash request is created.
- [ ] **M14-5** **Edge** Mr. Kamran Qureshi can't move Ms. Sadia Rehman's slot → "You can only change your own timetable slots."
- [ ] **M14-6** Admin → Timetable clashes → **Resolve** → **Tuesday 11:00**, room **102** → the clash disappears and **"No clashes" shows without reloading**; Kamran and the students get a notification.
- [ ] **M14-7** Create another clash the same way, then **Dismiss** it → gone; the "All" view shows it as Dismissed.
- [ ] **M14-8** **Edge** In a second admin tab still showing the resolved clash, resolve it again → "This clash has already been handled."

## M15. Calendar and To-do

- [ ] **M15-1** Ahsan → Calendar: Event Concept Proposal and Online Quiz 1 on their due dates, and the Monday 09:00 class; month and week views work.
- [ ] **M15-2** Filter by class DEM-102 → only its events.
- [ ] **M15-3** Ahsan → To-do: Online Quiz 1 under Assigned; Event Concept Proposal under Done.
- [ ] **M15-4** **Edge** Venue Checklist (closed in M8-9, never submitted) is under Missing.

## M16. Notifications (as Ahsan unless noted)

- [ ] **M16-1** Ahsan has notifications for: the new assignment, the announcement, the graded proposal, the timetable change; Daniyal for the returned quiz; Mr. Kamran Qureshi for the resolved clash.
- [ ] **M16-2** Bell shows the unread count; the popup lists them; clicking one opens the right page and marks it read.
- [ ] **M16-3** **Mark all read** (popup, then the page) → count 0.
- [ ] **M16-4** Delete one with × → gone.
- [ ] **M16-5** **Clear all** in the bell popup → confirmation; **Cancel** keeps them. On the Notifications page → **Clear all** → confirm → list empty, bell 0.
- [ ] **M16-6** **Edge** Refresh after Clear all → still empty (older, unloaded ones went too).
- [ ] **M16-7** **Edge** Ahsan's Clear all didn't touch Daniyal's notifications.
- [ ] **M16-8** Notifications page filters: All / Unread and by type.

## M17. Search (Ctrl+K)

- [ ] **M17-1** As admin: `Event Management` finds the DEM classes; `Ahsan` finds the student.
- [ ] **M17-2** **Edge** As Mahnoor (section B), `DEM-102` finds nothing she isn't in.
- [ ] **M17-3** **Edge** Search `%`, `'` and `<script>alert(1)</script>` → no error, nothing pops up.

## M18. Settings, profile, archived classes

- [ ] **M18-1** As Ahsan, Profile → upload a profile photo (JPG/PNG) → shows in the header and on his comments.
- [ ] **M18-2** **Edge** Upload a PDF as the photo → refused.
- [ ] **M18-3** Admin → Settings → **Open platform settings** → popup; change a setting, save, then put it back.
- [ ] **M18-4** Switch light / dark theme → pages stay readable in both.
- [ ] **M18-5** Ms. Sadia Rehman archives **Event Management Study Circle** → it moves to Archived classes and is read-only (no posting, no submitting); restore it → back to normal.

## M19. Dashboards, sidebar and permissions

- [ ] **M19-1** Admin dashboard: only the University section: Students, Teachers, Diplomas, Courses, **Teachers to be assigned**, **Awaiting approval payments**, **Unpaid fees**; each card opens its page.
- [ ] **M19-2** Ms. Sadia Rehman's dashboard: term banner, then **Active classes**, **Archived classes**, **Pending reviews** only.
- [ ] **M19-3** Ahsan's dashboard: My studies (roll no EITHM-26-EM-001, CGPA, attendance, fees) and upcoming deadlines.
- [ ] **M19-4** Admin sidebar groups: Overview · Schedule · Learning · Academics · People · Assessment · Finance · Administration · Account. No Classrooms, no To review, no Take attendance.
- [ ] **M19-5** Teacher sidebar: To review, Marks, Attendance, Grades, Classes, Archived classes; no admin pages.
- [ ] **M19-6** Student sidebar: To-do, My courses, Registration, Attendance, Marks, Transcript, Fee challan.
- [ ] **M19-7** **Edge** As Ahsan, type `/admin/users`, `/marks`, `/review`, `/grades` → sent back with "not allowed".
- [ ] **M19-8** **Edge** As Ms. Sadia Rehman, type `/admin/fees` → sent back.
- [ ] **M19-9** **Edge** As Mahnoor, open DEM-102 · 2026 A's address (copy it from Ahsan's window) → "Class not found".
- [ ] **M19-10** **Edge** As admin, open `/admin/classrooms` → Not found page.
- [ ] **M19-11** Phone width: sidebar becomes a menu; tables scroll inside their card; no sideways page scroll; popups fit.
- [ ] **M19-12** Tablet width: nothing cut off.

## M20. Audit logs (admin)

- [ ] **M20-1** Today's actions are listed with who and when: Sadia's account created, Mahnoor's password reset, grades released, Ahsan's challan approved, the clash resolved.
- [ ] **M20-2** Filter by action and date → narrows the list.
- [ ] **M20-3** **Edge** As Ms. Sadia Rehman, `/admin/audit-logs` → sent back.

---

## Cleanup

Everything created here belongs to the **Event Management** programme and its **Diploma in Event Management (DEM)**, plus:
- teachers **Ms. Sadia Rehman**, **Mr. Kamran Qureshi**
- students **Ahsan Mehmood**, **Mahnoor Tariq**, **Daniyal Shah**
- the hand-made class **Event Management Study Circle**

To remove it, delete those users and delete the DEM offerings, courses, the DEM sections in batch 2026, the diploma and the Event Management programme (in that order), or ask for a cleanup script. If you'd like to keep Event Management as a real programme, just delete the five people and the study circle.
