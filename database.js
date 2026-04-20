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
    plan_type TEXT DEFAULT 'free',
    payment_status TEXT DEFAULT 'trial',
    payment_due_date DATE,
    expires_at DATETIME,
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

// Migração automática de colunas
const cols = db.prepare("PRAGMA table_info(barbershops)").all().map((c) => c.name);
const colsToAdd = ["owner_name", "cpf", "cnpj", "city", "state", "zip_code"];
colsToAdd.forEach(col => {
    if (!cols.includes(col)) db.exec(`ALTER TABLE barbershops ADD COLUMN ${col} TEXT`);
});

if (!cols.includes("plan_type")) db.exec("ALTER TABLE barbershops ADD COLUMN plan_type TEXT DEFAULT 'free'");
if (!cols.includes("payment_status")) db.exec("ALTER TABLE barbershops ADD COLUMN payment_status TEXT DEFAULT 'trial'");
if (!cols.includes("payment_due_date")) db.exec("ALTER TABLE barbershops ADD COLUMN payment_due_date DATE");
if (!cols.includes("expires_at")) db.exec("ALTER TABLE barbershops ADD COLUMN expires_at DATETIME");
if (!cols.includes("active")) db.exec("ALTER TABLE barbershops ADD COLUMN active INTEGER DEFAULT 1");

// --- SEED DE SEGURANÇA (FORÇA A CRIAÇÃO DOS ACESSOS) ---

// 1. Garante que a Barbearia Demo exista
let shop = db.prepare("SELECT id FROM barbershops WHERE id = 2").get();
if (!shop) {
    db.prepare(`
        INSERT INTO barbershops (id, name, public_id, owner_name, phone, address, city, state, plan_type, payment_status, active)
        VALUES (2, 'Barber Flow Demo', 'bDM8UCcASg', 'Marco Admin', '(11) 99999-9999', 'Rua Exemplo, 123', 'Atibaia', 'SP', 'pro', 'active', 1)
    `).run();
}

// 2. Garante que o usuário DONO exista (senha 12345678)
const existingOwner = db.prepare("SELECT id FROM users WHERE email = 'dono@barbearia.com'").get();
if (!existingOwner) {
    const hashOwner = bcrypt.hashSync("12345678", 10);
    db.prepare(`INSERT INTO users (barbershop_id, email, password_hash, name, role) VALUES (2, 'dono@barbearia.com', ?, 'Dono da Barbearia', 'owner')`).run(hashOwner);
}

// 3. Garante que o usuário ADMIN exista (senha admin2024)
const existingAdmin = db.prepare("SELECT id FROM users WHERE email = 'admin@barberflow.com'").get();
if (!existingAdmin) {
    const hashAdmin = bcrypt.hashSync("admin2024", 10);
    db.prepare(`INSERT INTO users (barbershop_id, email, password_hash, name, role) VALUES (2, 'admin@barberflow.com', ?, 'Administrador Master', 'admin')`).run(hashAdmin);
    console.log("Admin Master recriado por segurança!");
}

module.exports = db;
