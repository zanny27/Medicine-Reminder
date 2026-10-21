# Medicine Reminder

A full-stack web application for tracking daily medicines, dosage schedules, and adherence — built as a CBAD (Cloud/Container Based Application Development) jury project to demonstrate containerization concepts alongside a working application.

## Project Description

Medicine Reminder lets a user add, edit, delete, and track medicines with dosage, timing, frequency, and a date range. A dashboard summarizes today's doses, upcoming medicines, and taken/pending counts. The entire application is containerized with Docker, using a named volume so data survives container restarts and recreation.

## Features

- Add, view, edit, and delete medicines
- Mark medicines as Taken / Pending
- Dashboard with live statistics (total, today's doses, taken, pending)
- Today's Medicines and Upcoming Medicines panels
- Responsive layout (desktop, tablet, mobile)
- Client-side and server-side input validation
- Persistent storage via SQLite + Docker volume

## Technology Stack

- **Frontend:** HTML5, CSS3, vanilla JavaScript
- **Backend:** Node.js (plain `http` module, no framework)
- **Database:** SQLite via `better-sqlite3`
- **Containerization:** Docker, with a named volume for persistent storage

## Architecture

**Application flow:**


**Docker internal architecture:**

## Project Structure

## Running Without Docker

```bash
npm install
node server.js
```
Then open `http://localhost:5000`.

## Running With Docker

```bash
docker build -t medicine-reminder .
docker volume create medicine-data
docker run -d --name medicine-reminder -p 5000:5000 -v medicine-data:/app/data medicine-reminder
```
Then open `http://localhost:5000`.

## Docker Commands

| Command | Purpose |
|---|---|
| `docker build -t medicine-reminder .` | Build the image from the Dockerfile |
| `docker run -d --name medicine-reminder -p 5000:5000 -v medicine-data:/app/data medicine-reminder` | Run a container from the image, with port mapping and volume mounted |
| `docker ps` | List running containers |
| `docker ps -a` | List all containers, including stopped ones |
| `docker logs medicine-reminder` | View container output/logs |
| `docker stop medicine-reminder` | Stop the running container |
| `docker rm medicine-reminder` | Remove the (stopped) container |
| `docker images` | List built images |
| `docker history medicine-reminder` | Show the image's layer history |
| `docker volume create medicine-data` | Create a named volume for persistent storage |

## Database

SQLite database (`medicines.db`) with a single `medicines` table:

| Column | Type | Notes |
|---|---|---|
| id | INTEGER | Primary key, autoincrement |
| name | TEXT | Required |
| dosage | TEXT | Required |
| time | TEXT | Required, HH:MM |
| frequency | TEXT | Required |
| start_date | TEXT | Required, YYYY-MM-DD |
| end_date | TEXT | Required, YYYY-MM-DD |
| notes | TEXT | Optional |
| status | TEXT | 'Pending' or 'Taken', defaults to 'Pending' |
| created_at | TEXT | Auto-set on insert |

All queries use parameterized statements (`better-sqlite3` named/positional placeholders) to prevent SQL injection.

## Docker Volume

The database is excluded from the built image (`.dockerignore`) and instead written to `/app/data` inside the container, which is mounted to the named volume `medicine-data` at runtime. This means:

- Deleting or recreating the container does **not** delete the data
- The volume persists independently on the host, managed by Docker
- Verified by: add a medicine → stop container → remove container → start a new container with the same volume → data is still present

## CBAD Concepts Demonstrated

| CBAD Concept | How it appears in this project |
|---|---|
| Docker Image | Built via `docker build`, tagged `medicine-reminder` |
| Docker Container | Running instance of the image, serving the app on port 5000 |
| Dockerfile | Defines base image, dependency install, app copy, port, start command |
| Docker CLI | `docker build`, `run`, `ps`, `logs`, `stop`, `rm`, `volume` |
| Docker Engine/Daemon | Background service executing all Docker CLI commands |
| Container Runtime (containerd/runc) | Underlying layers the Daemon delegates container execution to |
| Image Layers | Each Dockerfile instruction (FROM, WORKDIR, RUN, COPY) is a separate layer |
| Layer Caching | Dependency install layers ordered before app code copy, so code changes don't force a reinstall |
| Networking / Port Mapping | `-p 5000:5000` maps container port to host port |
| Volume | Named volume `medicine-data` mounted to `/app/data` for persistent SQLite storage |
| Namespaces | Provide the container's isolated process/filesystem view (conceptual — managed by Docker/kernel, not directly configured) |
| Cgroups | Provide resource limiting/accounting for the container (conceptual — managed by Docker/kernel) |

## Future Improvements

- Browser push notifications for medicine reminders
- Multi-user accounts and authentication
- Recurring reminder scheduling beyond simple date ranges
- Export medicine history as PDF/CSV