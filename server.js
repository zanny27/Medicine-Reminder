const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const Database = require("better-sqlite3");

const PORT = process.env.PORT || 5000;

// ---------- Database Setup ----------
// Stored under data/ so it can be mounted as a Docker volume later
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "medicines.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS medicines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    time TEXT NOT NULL,
    frequency TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// ---------- Static File Serving ----------
const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".ico": "image/x-icon"
};

function serveStatic(req, res, pathname) {
  // Map /static/... requests to the static/ folder on disk
  const filePath = path.join(__dirname, pathname);

  // Prevent path traversal (e.g. /static/../server.js)
  if (!filePath.startsWith(path.join(__dirname, "static"))) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(content);
  });
}
// ---------- Helpers ----------
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1e6) req.destroy(); // basic size guard
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function validateMedicine(m) {
  if (!m.name || !m.name.trim()) return "Medicine name is required.";
  if (!m.dosage || !m.dosage.trim()) return "Dosage is required.";
  if (!m.time || !/^\d{2}:\d{2}$/.test(m.time)) return "A valid time is required.";
  if (!m.frequency) return "Frequency is required.";
  if (!m.start_date || !/^\d{4}-\d{2}-\d{2}$/.test(m.start_date)) return "A valid start date is required.";
  if (!m.end_date || !/^\d{4}-\d{2}-\d{2}$/.test(m.end_date)) return "A valid end date is required.";
  if (m.end_date < m.start_date) return "End date cannot be before start date.";
  return null;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- Request Router ----------
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method = req.method;

  try {
    // Serve frontend page
    if (pathname === "/" && method === "GET") {
      const html = fs.readFileSync(path.join(__dirname, "templates", "index.html"), "utf-8");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
      return;
    }

    // Serve static assets
    if (pathname.startsWith("/static/") && method === "GET") {
      serveStatic(req, res, pathname);
      return;
    }

    // ---- API: GET all medicines ----
    if (pathname === "/api/medicines" && method === "GET") {
      const rows = db.prepare("SELECT * FROM medicines ORDER BY time ASC").all();
      sendJSON(res, 200, rows);
      return;
    }

    // ---- API: POST create medicine ----
    if (pathname === "/api/medicines" && method === "POST") {
      const body = await readBody(req);
      const error = validateMedicine(body);
      if (error) return sendJSON(res, 400, { error });

      const stmt = db.prepare(`
        INSERT INTO medicines (name, dosage, time, frequency, start_date, end_date, notes, status)
        VALUES (@name, @dosage, @time, @frequency, @start_date, @end_date, @notes, 'Pending')
      `);
      const info = stmt.run({
        name: body.name.trim(),
        dosage: body.dosage.trim(),
        time: body.time,
        frequency: body.frequency,
        start_date: body.start_date,
        end_date: body.end_date,
        notes: body.notes ? body.notes.trim() : ""
      });
      const created = db.prepare("SELECT * FROM medicines WHERE id = ?").get(info.lastInsertRowid);
      sendJSON(res, 201, created);
      return;
    }

    // Routes below need an :id — extract it
    const idMatch = pathname.match(/^\/api\/medicines\/(\d+)(\/taken)?$/);

    // ---- API: PUT update medicine ----
    if (idMatch && !idMatch[2] && method === "PUT") {
      const id = Number(idMatch[1]);
      const existing = db.prepare("SELECT * FROM medicines WHERE id = ?").get(id);
      if (!existing) return sendJSON(res, 404, { error: "Medicine not found." });

      const body = await readBody(req);
      const error = validateMedicine(body);
      if (error) return sendJSON(res, 400, { error });

      db.prepare(`
        UPDATE medicines
        SET name=@name, dosage=@dosage, time=@time, frequency=@frequency,
            start_date=@start_date, end_date=@end_date, notes=@notes
        WHERE id=@id
      `).run({
        id,
        name: body.name.trim(),
        dosage: body.dosage.trim(),
        time: body.time,
        frequency: body.frequency,
        start_date: body.start_date,
        end_date: body.end_date,
        notes: body.notes ? body.notes.trim() : ""
      });
      const updated = db.prepare("SELECT * FROM medicines WHERE id = ?").get(id);
      sendJSON(res, 200, updated);
      return;
    }

    // ---- API: DELETE medicine ----
    if (idMatch && !idMatch[2] && method === "DELETE") {
      const id = Number(idMatch[1]);
      const existing = db.prepare("SELECT * FROM medicines WHERE id = ?").get(id);
      if (!existing) return sendJSON(res, 404, { error: "Medicine not found." });

      db.prepare("DELETE FROM medicines WHERE id = ?").run(id);
      sendJSON(res, 200, { message: "Deleted", id });
      return;
    }

    // ---- API: PATCH toggle taken/pending ----
    if (idMatch && idMatch[2] && method === "PATCH") {
      const id = Number(idMatch[1]);
      const existing = db.prepare("SELECT * FROM medicines WHERE id = ?").get(id);
      if (!existing) return sendJSON(res, 404, { error: "Medicine not found." });

      const newStatus = existing.status === "Taken" ? "Pending" : "Taken";
      db.prepare("UPDATE medicines SET status = ? WHERE id = ?").run(newStatus, id);
      const updated = db.prepare("SELECT * FROM medicines WHERE id = ?").get(id);
      sendJSON(res, 200, updated);
      return;
    }

    // ---- API: GET dashboard stats ----
    if (pathname === "/api/dashboard" && method === "GET") {
      const all = db.prepare("SELECT * FROM medicines ORDER BY time ASC").all();
      const today = todayStr();

      const todayMeds = all.filter(m => m.start_date <= today && today <= m.end_date);
      const upcoming = all.filter(m => m.start_date > today).slice(0, 5);
      const taken = all.filter(m => m.status === "Taken").length;
      const pending = all.filter(m => m.status === "Pending").length;

      sendJSON(res, 200, {
        total: all.length,
        today_count: todayMeds.length,
        taken_count: taken,
        pending_count: pending,
        today: todayMeds,
        upcoming
      });
      return;
    }

    // No route matched
    sendJSON(res, 404, { error: "Route not found." });

  } catch (err) {
    console.error(err);
    sendJSON(res, 500, { error: err.message || "Internal server error." });
  }
});

server.listen(PORT, () => {
  console.log(`Medicine Reminder server running at http://localhost:${PORT}`);
});