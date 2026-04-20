const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");

const db = new Database(path.join(__dirname, "barberflow.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS barbershops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    public_id TEXT UNIQUE NOT NULL,
    owner_name TEXT,
    cpf TEXT,
    cnpj TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    payment_status TEXT DEFAULT 'trial',
    payment_due_date DATE,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barbershop_id INTEGER NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'owner',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (barbershop_id) REFERENCES barbershops(id)
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barbershop_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL DEFAULT 0,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (barbershop_id) REFERENCES barbershops(id)
  );

  CREATE TABLE IF NOT EXISTS professionals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barbershop_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    specialties TEXT,
    working_days TEXT DEFAULT '1,2,3,4,5',
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (barbershop_id) REFERENCES barbershops(id)
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barbershop_id INTEGER NOT NULL,
    professional_id INTEGER,
    service_id INTEGER,
    client_name TEXT NOT NULL,
    client_phone TEXT,
    scheduled_at DATETIME NOT NULL,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (barbershop_id) REFERENCES barbershops(id),
    FOREIGN KEY (professional_id) REFERENCES professionals(id),
    FOREIGN KEY (service_id) REFERENCES services(id)
  );
`);

// Migração — adiciona colunas novas se não existirem
const cols = db.prepare("PRAGMA table_info(barbershops)").all().map((c) => c.name);
if (!cols.includes("owner_name")) db.exec("ALTER TABLE barbershops ADD COLUMN owner_name TEXT");
if (!cols.includes("cpf")) db.exec("ALTER TABLE barbershops ADD COLUMN cpf TEXT");
if (!cols.includes("cnpj")) db.exec("ALTER TABLE barbershops ADD COLUMN cnpj TEXT");
if (!cols.includes("city")) db.exec("ALTER TABLE barbershops ADD COLUMN city TEXT");
if (!cols.includes("state")) db.exec("ALTER TABLE barbershops ADD COLUMN state TEXT");
if (!cols.includes("zip_code")) db.exec("ALTER TABLE barbershops ADD COLUMN zip_code TEXT");
if (!cols.includes("payment_status")) db.exec("ALTER TABLE barbershops ADD COLUMN payment_status TEXT DEFAULT 'trial'");
if (!cols.includes("payment_due_date")) db.exec("ALTER TABLE barbershops ADD COLUMN payment_due_date DATE");
if (!cols.includes("active")) db.exec("ALTER TABLE barbershops ADD COLUMN active INTEGER DEFAULT 1");

// Seed inicial
const existing = db.prepare("SELECT id FROM barbershops WHERE id = 2").get();
if (!existing) {
  db.prepare(`
    INSERT OR IGNORE INTO barbershops (id, name, public_id, owner_name, phone, address, city, state, payment_status, active)
    VALUES (2, 'Barber Flow Demo', 'bDM8UCcASg', 'Marco Admin', '(11) 99999-9999', 'Rua Exemplo, 123', 'Atibaia', 'SP', 'active', 1)
  `).run();

  const hash = bcrypt.hashSync("12345678", 10);
  db.prepare(`
    INSERT OR IGNORE INTO users (barbershop_id, email, password_hash, name, role)
    VALUES (2, 'dono@barbearia.com', ?, 'Dono da Barbearia', 'owner')
  `).run(hash);

  // Admin master
  const hashAdmin = bcrypt.hashSync("admin2024", 10);
  db.prepare(`
    INSERT OR IGNORE INTO users (barbershop_id, email, password_hash, name, role)
    VALUES (2, 'admin@barberflow.com', ?, 'Administrador', 'admin')
  `).run(hashAdmin);

  const svc = db.prepare(`INSERT INTO services (barbershop_id, name, price_cents, duration_minutes) VALUES (?, ?, ?, ?)`);
  svc.run(2, "Corte Simples", 3500, 30);
  svc.run(2, "Corte Degradê", 4500, 45);
  svc.run(2, "Barba", 2500, 20);
  svc.run(2, "Corte + Barba", 6500, 60);

  const pro = db.prepare(`INSERT INTO professionals (barbershop_id, name, phone, specialties, working_days) VALUES (?, ?, ?, ?, ?)`);
  pro.run(2, "Carlos Silva", "11999990001", "Corte, Degradê, Barba", "1,2,3,4,5,6");
  pro.run(2, "Ricardo Souza", "11999990002", "Corte Clássico, Barba", "1,2,3,4,5");

  console.log("Seed criado!");
}

module.exports = db;
