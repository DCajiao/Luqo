FROM postgres:16-alpine

COPY definitions/schema.sql /docker-entrypoint-initdb.d/01-schema.sql

EXPOSE 5432
