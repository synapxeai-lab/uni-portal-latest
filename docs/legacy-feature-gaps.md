# Features missing from the old University Portal

University Portal features that didn't make it into the unified portal, still to be addressed. The classroom (GCR) features are left out. Compiled 2026-11-13 by checking every endpoint, page, and every button, field and table column on each page in the old `University-portal` against the unified code.

**Overall:** the API was carried over almost completely: every old endpoint has an equivalent, some under a different path. The gaps are mostly in the **screens**: reports, drill-down pages, personal profile views and list columns.

Key: ✅ carried over · ⚠️ partly · ❌ missing

## To address

### Missing entirely (❌)

- [ ] **1. Word (.doc) report downloads** for fee challans and teacher pay. In the old app, `utils/docReport.js` built an HTML table saved as `.doc`, with no library needed.
- [ ] **2. Fee challans drill-down**: programme → section → students. Old pages: `FeeChallansProgrammePage`, `FeeChallansSectionPage`. Unified has one flat list.
- [ ] **3. Teacher "My Students" page**: every student across the teacher's courses, searchable by name, roll no or email, with a course filter and a contact column. Old pages: `TeacherStudentsPage`, `TeacherSectionDetailPage`. Unified only has each classroom's People tab.
- [ ] **4. Remove profile photo** in Settings. Unified can only upload or replace.
- [ ] **5. Caps-lock warning** on password fields: login, settings, and the users dialogs.
- [ ] **6. Maintenance screen**: a full-screen notice while the API is unreachable (e.g. during a deploy). It overlays the page, so unsaved input survives, disappears once `/health` answers, and then refetches data. Old file: `components/MaintenanceScreen.jsx`.
- [ ] **7. Grid/list view toggle** on list pages (batches, sections, offerings, challans, registration, marks). Unified uses tables only.

### Carried over only in part (⚠️)

- [ ] **8. Attendance for a past date.** Old: "Add attendance" with a date picker, so any date could be recorded. Unified: only **today** can be taken; past days can be reopened only if they were already taken.
- [ ] **9. Own profile view for teachers and students.** The old home pages showed "My Profile":
  - teachers: CNIC, phone, address, qualification, programme;
  - students: address, batch, current diploma, guardian.

  Unified `/profile` shows only photo, name, email and role.
- [ ] **10. Student detail page (admin).**
  - Missing the **fee challans section with Approve** (old `StudentFeesSection`).
  - Missing fields: gender, address, board/university, passing year, grade, guardian CNIC, email and relationship.
- [ ] **11. List columns.**
  - Students list lost CNIC, contact, guardian and last qualification.
  - Teachers list lost CNIC, contact and courses.
- [ ] **12. Search boxes.**
  - Assign teachers: the old page searched by course name, code or teacher.
  - A batch section's student list.
- [ ] **13. Dashboard counts.** The admin dashboard has no **Total users** or **Programmes** count.
- [ ] **14. Delete user.** Unified archives or deactivates instead. Probably intentional; confirm with the client.

## Full comparison

### Admin

| Old feature | Unified | What's missing |
|---|---|---|
| Dashboard stats (users, teachers, students, programmes, diplomas, courses) + current term card | ⚠️ | No Total users or Programmes count |
| Programmes → diplomas → sections / courses | ✅ | Merged into fewer pages |
| Batches, batch detail, a batch's section with student list and search | ⚠️ | No search box on the section's students |
| Courses list, course detail with assessment scheme and teachers | ✅ | — |
| Offer courses, plus per-batch offering detail | ✅ | Unified also auto-offers when registration opens |
| Assign teacher: search by course, code or teacher + status filter, unassign | ⚠️ | No search box (only programme and diploma filters) |
| Registration: start, end, end semester, delete, semester dates, credit limits | ✅ | — |
| Teachers: full form (personal, professional, guardian, pay type) | ✅ | List lost the CNIC, contact and courses columns |
| Students list with CNIC, contact, guardian, last qualification columns | ⚠️ | Shows only roll no, programme, batch, diploma, login |
| Student detail: personal, contact, academic, previous education, guardian, courses | ⚠️ | Missing fields (see 10) and the fee challans section with Approve |
| Fee challans: list, search, programme and status filters, approve | ✅ | — |
| Fee challans by programme → section → students | ❌ | Flat list only |
| Download fee challans as a Word report | ❌ | — |
| Teacher pay table | ✅ | — |
| Download teacher pay as a Word report | ❌ | — |
| Attendance: course → section → dates → roster | ✅ | Reorganised (Attendance overview + Take attendance) |
| Marks: course → section, percentage override | ✅ | Via the Marks page |
| Grade criteria (separate page) | ✅ | Now a dialog on the Marks page |
| Grades: generate, release, override, unpublish | ✅ | — |
| Users: search, role filter, create, edit, view/copy password, reset password | ✅ | Temporary password generated instead of admin-chosen |
| Users: delete user | ⚠️ | Archive or deactivate instead |

### Teacher

| Old feature | Unified | What's missing |
|---|---|---|
| Home: My Profile + courses I teach | ⚠️ | Own academic profile not shown |
| My Courses with search → course detail (my sections, student counts) | ⚠️ | Covered by Classes and the Marks/Attendance pickers; no list with student counts per section |
| My Students: all students, search, course filter, contact, grid/list | ❌ | Only each classroom's People tab |
| Attendance: dates list + "Add attendance" with a date picker | ⚠️ | Today only |
| Marks: categories → assessments → enter marks, totals, add/delete items | ✅ | Plus the per-student marksheet |
| Grading criteria, grades, releases | ✅ | — |

### Student

| Old feature | Unified | What's missing |
|---|---|---|
| Home: My Profile + registration status with "Go register" | ⚠️ | Registration status ✅, own profile ❌ |
| Registration (failed/missed tags, sections, credit-limit warnings) | ✅ | — |
| My courses | ✅ | — |
| Attendance | ✅ | Unified adds the date-by-date history |
| Marks, with per-course detail | ✅ | Course dropdown |
| Transcript (SGPA, CGPA, grade points) | ✅ | Unified adds Print |
| Fee challan: pay to account, mark paid, awaiting approval | ✅ | Grid/list toggle not carried over |

### Shared / account

| Old feature | Unified | What's missing |
|---|---|---|
| Settings: photo, account details, change password | ✅ | — |
| Remove profile photo | ❌ | — |
| Caps-lock warning on password fields | ❌ | — |
| Maintenance screen when the API is down | ❌ | — |
| Grid/list view toggle on list pages | ❌ | — |

## UI differences

See [legacy-ui-differences.md](legacy-ui-differences.md).

## Deliberate design changes (not gaps)

- Grading criteria moved from a separate page into a dialog on the Marks page.
- New users get a generated temporary password instead of one the admin types.
- Users are archived or deactivated rather than deleted.
- A student's courses and a teacher's courses live in Classes, the classroom view.
- Marks and attendance moved to the sidebar pages, with a course-section picker instead of course → section drill-down pages.
