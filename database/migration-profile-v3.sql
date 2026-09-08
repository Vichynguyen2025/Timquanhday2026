-- Add profile fields to users table
ALTER TABLE users
  ADD COLUMN gender VARCHAR(20) NULL AFTER bio,
  ADD COLUMN birth_year INT NULL AFTER gender,
  ADD COLUMN hometown VARCHAR(100) NULL AFTER birth_year,
  ADD COLUMN occupation VARCHAR(100) NULL AFTER hometown,
  ADD COLUMN school VARCHAR(200) NULL AFTER occupation;