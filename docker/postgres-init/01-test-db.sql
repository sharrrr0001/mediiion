-- Separate database for automated API tests (wiped by tests).
CREATE DATABASE medicos_test;
-- Shadow database for `prisma migrate diff` drift checks (Prisma wipes it on every use).
CREATE DATABASE medicos_shadow;
