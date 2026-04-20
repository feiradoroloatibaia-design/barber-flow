require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const db = require("./database");
const { authMiddleware, generateToken } = require("./auth");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ 
  origin: "*", 
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"], 
  allowedHeaders: ["Content-Type","Authorization"] 
}));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// ── AUTH ─────────────────────────────────────────────────
app.post("/api/auth/register", (req, res) => {
  const { email, password, name, barbershop_name } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email e senha são obrigatórios" });
  try {
    if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) return res.status(400).json({ error: "Email já cadastrado" });
    const publicId = Math.random().toString(36).substring(2, 12);
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);
    const shop = db.prepare(`
      INSERT INTO barbershops (name, public_id, plan_type, payment_status, expires_at, active)
      VALUES (?, ?, 'free', 'trial', ?, 1) RETURNING *
    `).get(barbershop_name || "Minha Barbearia", publicId, expires.toISOString());
    const hash = bcrypt.hashSync(password, 10);
    const user = db.prepare("INSERT INTO users (barbershop_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, 'owner') RETURNING id, email, name, barbershop_id").get(shop.id, email, hash, name || "");
    const token = generateToken({ userId: user.id, barbershopId: shop.id, email, role: "owner" });
    res.status(201).json({ token, access_token: token, user: { id: user.id, email, name, barbershopId: shop.id, role: "owner" } });
  } catch (err) { console.error(err); res.status(500).json({ error: "Erro interno" }); }
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email e senha são obrigatórios" });
  try {
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: "Credenciais inválidas" });
    }

    // Se for o admin mestre, ignoramos bloqueios de barbearia
    if (user.email !== "admin@barberflow.com" && user.role !== "admin") {
      const shop = db.prepare("SELECT * FROM barbershops WHERE id = ?").get(user.barbershop_id);
      if (shop?.active === 0) return res.status(403).json({ error: "Acesso suspenso." });
    }

    const token = generateToken({ 
      userId: user.id, 
      barbershopId: user.barbershop_id, 
      email: user.email, 
      role: user.email === "admin@barberflow.com" ? "admin" : user.role 
    });

    res.json({ 
      token, 
      access_token: token, 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        barbershopId: user.barbershop_id, 
        role: user.email === "admin@barberflow.com" ? "admin" : user.role
      } 
    });
  } catch (err) { console.error(err); res.status(500).json({ error: "Erro interno" }); }
});

app.post("/api/auth/refresh", authMiddleware, (req, res) => {
  const role = req.user.email === "admin@barberflow.com" ? "admin" : req.user.role;
  const token = generateToken({ userId: req.user.userId, barbershopId: req.user.barbershopId, email: req.user.email, role: role });
  res.json({ token, access_token: token });
});

// ── PERFIL DA BARBEARIA ──────────────────────────────────
app.get("/api/barbershops/:id/profile", authMiddleware, (req, res) => {
  const shop = db.prepare("SELECT * FROM barbershops WHERE id = ?").get(req.params.id);
  if (!shop) return res.status(404).json({ error: "Barbearia não encontrada" });
  res.json(shop);
});

app.put("/api/barbershops/:id/profile", authMiddleware, (req, res) => {
  const { name, owner_name, cpf, cnpj, phone, address, city, state, zip_code } = req.body;
  db.prepare(`
    UPDATE barbershops SET
      name = COALESCE(?, name), owner_name = COALESCE(?, owner_name),
      cpf = COALESCE(?, cpf), cnpj = COALESCE(?, cnpj),
      phone = COALESCE(?, phone), address = COALESCE(?, address),
      city = COALESCE(?, city), state = COALESCE(?, state),
      zip_code = COALESCE(?, zip_code)
    WHERE id = ?
  `).run(name, owner_name, cpf, cnpj, phone, address, city, state, zip_code, req.params.id);
  res.json(db.prepare("SELECT * FROM barbershops WHERE id = ?").get(req.params.id));
});

// ── ADMIN (Middleware e Rotas) ───────────────────────────
function adminMiddleware(req, res, next) {
  // BYPASS DE EMERGÊNCIA: Se for seu email, você passa direto
  if (req.user?.email === "admin@barberflow.com" || req.user?.role === "admin") {
    return next();
  }
  return res.status(403).json({ error: "Acesso negado." });
}

app.get("/api/admin/barbershops", authMiddleware, adminMiddleware, (req, res) => {
  const shops = db.prepare(`
    SELECT b.*, u.email as owner_email
    FROM barbershops b
    LEFT JOIN users u ON u.barbershop_id = b.id AND u.role = 'owner'
    ORDER BY b.created_at DESC
  `).all();
  res.json(shops);
});

app.patch("/api/admin/barbershops/:id/status", authMiddleware, adminMiddleware, (req, res) => {
  const { active, payment_status, plan_type, expires_at, payment_due_date } = req.body;
  db.prepare(`
    UPDATE barbershops SET
      active = COALESCE(?, active),
      payment_status = COALESCE(?, payment_status),
      plan_type = COALESCE(?, plan_type),
      expires_at = COALESCE(?, expires_at),
      payment_due_date = COALESCE(?, payment_due_date)
    WHERE id = ?
  `).run(active, payment_status, plan_type, expires_at, payment_due_date, req.params.id);
  res.json(db.prepare("SELECT * FROM barbershops WHERE id = ?").get(req.params.id));
});

// ── SERVIÇOS ─────────────────────────────────────────────
app.get("/api/barbershops/:id/services", authMiddleware, (req, res) => {
  res.json(db.prepare("SELECT * FROM services WHERE barbershop_id = ? AND active = 1 ORDER BY created_at ASC").all(req.params.id));
});
app.post("/api/barbershops/:id/services", authMiddleware, (req, res) => {
  const { name, price_cents, duration_minutes } = req.body;
  if (!name) return res.status(400).json({ error: "Nome é obrigatório" });
  res.status(201).json(db.prepare("INSERT INTO services (barbershop_id,
