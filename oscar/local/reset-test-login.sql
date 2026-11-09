-- Resets the local Open-OSP test login to a fixed, known state.
-- Run inside the database container (Docker Desktop, open-osp-db-1, Exec):
--   mysql -uroot -p"$MYSQL_ROOT_PASSWORD" oscar < /path/to/reset-test-login.sql
-- or paste the UPDATE line into: mysql -uroot -p"$MYSQL_ROOT_PASSWORD" oscar
--
-- Login after reset: openodoc / mac2002 / PIN 1117. Test data only, never a
-- real chart. The Open-O 25 image ships with user openodoc (not oscardoc),
-- PIN 2025 and a forced password change, which is why the demo login fails.
UPDATE security
   SET password = '{bcrypt}$2b$12$Jfn3iVROqyjyMdTyvtwdSuj6UcAn9rIu3nvb1LaYlGGbETGg2NnBa',
       pin = '1117',
       forcePasswordReset = 0,
       date_ExpireDate = '2099-12-31'
 WHERE user_name = 'openodoc';
