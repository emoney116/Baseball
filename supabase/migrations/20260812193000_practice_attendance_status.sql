alter table public.practice_attendance
  add column if not exists status text not null default 'Present';

alter table public.practice_attendance
  drop constraint if exists practice_attendance_status_check;

alter table public.practice_attendance
  add constraint practice_attendance_status_check
  check (status in ('Present', 'Absent', 'Excused', 'Late'));
