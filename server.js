const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

/* ================= EMAIL ================= */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "financeirorhportal@gmail.com",
    pass: "ffrbnwffhlgdbmkc"
  }
});

/* ================= BANCO ================= */

const db = new sqlite3.Database("relatorios.db");

db.serialize(() => {

  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT UNIQUE,
      senha TEXT,
      nome TEXT,
      tipo TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS relatorios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT,
      equipe TEXT,
      lider TEXT,
      veiculo TEXT,
      km_inicial TEXT,
      km_final TEXT,
      combustivel TEXT,
      ocorrencias TEXT,
      faltas TEXT,
      ft TEXT
    )
  `);

  // Garante que a coluna veiculo exista (caso banco já tenha sido criado antes)
  db.run(`ALTER TABLE relatorios ADD COLUMN veiculo TEXT`, () => {});

  const usuarios = [
    ["flavio", "7182", "FLAVIO", "lider"],
    ["lucas", "8293", "LUCAS", "lider"],
    ["anizio", "9371", "ANIZIO", "lider"],
    ["manasses", "9382", "MANASSES", "lider"],
    ["jeisi", "1975", "JEISI", "admin"],
    ["admin2", "1971", "ADMIN", "admin"]
  ];

  usuarios.forEach(u => {
    db.run(`
      INSERT OR IGNORE INTO usuarios (usuario, senha, nome, tipo)
      VALUES (?, ?, ?, ?)
    `, u);
  });

});

/* ================= LOGIN ================= */

app.post("/login", (req, res) => {

  const { usuario, senha } = req.body;

  db.get(
    "SELECT * FROM usuarios WHERE usuario = ? AND senha = ?",
    [usuario, senha],
    (err, user) => {

      if (user) {
        res.json(user);
      } else {
        res.status(401).send("Login inválido");
      }

    }
  );

});

/* ================= SALVAR RELATÓRIO ================= */

app.post("/relatorio", (req, res) => {

  const {
    data,
    equipe,
    lider,
    veiculo,
    km_inicial,
    km_final,
    combustivel,
    ocorrencias,
    faltas,
    ft
  } = req.body;

  db.run(
    `INSERT INTO relatorios 
    (data, equipe, lider, veiculo, km_inicial, km_final, combustivel, ocorrencias, faltas, ft)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data, equipe, lider, veiculo, km_inicial, km_final, combustivel, ocorrencias, faltas, ft],
    function (err) {

      if (err) {
        return res.status(500).send(err.message);
      }

      transporter.sendMail({
        from: "financeirorhportal@gmail.com",
        to: "administracao@portaldosnobres.com",
        subject: "RELATÓRIO DE TURNO",
        text: `
Data: ${data}
Equipe: ${equipe}
Líder: ${lider}
Veículo: ${veiculo}
KM: ${km_inicial} - ${km_final}
`
      });

      res.json({ mensagem: "Salvo com sucesso" });

    }
  );

});

/* ================= ÚLTIMOS 4 RELATÓRIOS ================= */

app.get('/ultimos-relatorios', (req, res) => {
  db.all(`
    SELECT * FROM relatorios
    ORDER BY id DESC
    LIMIT 4
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ erro: err.message });
    }
    res.json(rows);
  });
});

/* ================= FILTRO RELATÓRIOS ================= */

app.get("/ver-relatorios", (req, res) => {

  const { data, equipe } = req.query;

  let sql = "SELECT * FROM relatorios WHERE 1=1";
  let params = [];

  if (data) {
    sql += " AND data = ?";
    params.push(data);
  }

  if (equipe) {
    sql += " AND equipe = ?";
    params.push(equipe);
  }

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.json(rows);
  });

});

/* ================= GERAR PDF ================= */

app.get("/gerar-pdf", (req, res) => {

  const { data, equipe } = req.query;

  let sql = "SELECT * FROM relatorios WHERE 1=1";
  let params = [];

  if (data) {
    sql += " AND data = ?";
    params.push(data);
  }

  if (equipe) {
    sql += " AND equipe = ?";
    params.push(equipe);
  }

  const doc = new PDFDocument();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=relatorios.pdf");

  doc.pipe(res);

  db.all(sql, params, (err, rows) => {

    if (err) {
      doc.text("Erro ao gerar relatório.");
      doc.end();
      return;
    }

    doc.fontSize(18).text("Relatórios Filtrados", { align: "center" });
    doc.moveDown();

    rows.forEach(r => {

      doc.fontSize(12).text(`Data: ${r.data}`);
      doc.text(`Equipe: ${r.equipe}`);
      doc.text(`Líder: ${r.lider}`);
      doc.text(`Veículo: ${r.veiculo}`);
      doc.text(`KM: ${r.km_inicial} - ${r.km_final}`);
      doc.text(`Combustível: ${r.combustivel}`);
      doc.text(`Ocorrências: ${r.ocorrencias}`);
      doc.text(`Faltas: ${r.faltas}`);
      doc.text(`FT: ${r.ft}`);
      doc.moveDown();

    });

    doc.end();

  });

});

/* ================= PÁGINAS ================= */

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/login.html");
});

app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/login.html");
});

app.get("/login-admin", (req, res) => {
  res.sendFile(__dirname + "/login-admin.html");
});

app.get("/sistema", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/admin", (req, res) => {
  res.sendFile(__dirname + "/admin.html");
});

/* ================= SERVIDOR ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
