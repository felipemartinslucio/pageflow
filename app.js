const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { body, validationResult } = require('express-validator');

const app = express();

// Configurações do Express
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuração para servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Configuração do middleware de sessão
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true,
}));

// Configuração do EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Função para garantir que os diretórios para armazenar páginas e metadados existam
function ensureDirs() {
  const pagesDir = path.join(__dirname, 'pages');
  const metadataDir = path.join(__dirname, 'metadata');
  if (!fs.existsSync(pagesDir)) {
    fs.mkdirSync(pagesDir);
  }
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir);
  }
}
ensureDirs();

// Middleware de autenticação
function checkAuthentication(req, res, next) {
  if (req.session.authenticated) {
    return next();
  }
  res.redirect('/login');
}

// Rota de login (POST)
app.post('/login', [
  body('username').trim().notEmpty().withMessage('Username é obrigatório.'),
  body('password').trim().notEmpty().withMessage('Password é obrigatório.')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    res.redirect('/dashboard');
  } else {
    res.status(401).send('Credenciais inválidas');
  }
});

// Rota de logout
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('Erro ao fazer logout');
    }
    res.redirect('/login');
  });
});

// Rota protegida
app.get('/dashboard', checkAuthentication, (req, res) => {
  res.render('dashboard');
});

// Rota de login (GET)
app.get('/login', (req, res) => {
  res.render('login');
});

// Rota para criar uma nova página (POST)
app.post('/create-page', checkAuthentication, [
  body('title').trim().notEmpty().withMessage('Título é obrigatório.'),
  body('url').trim().notEmpty().withMessage('URL é obrigatória.'),
  body('content').trim().notEmpty().withMessage('Conteúdo é obrigatório.'),
  body('category').trim().notEmpty().withMessage('Categoria é obrigatória.')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { title, url, content, category } = req.body;

  const filePath = path.join(__dirname, 'pages', `${url}.txt`);
  const metadataPath = path.join(__dirname, 'metadata', `${url}.json`);

  fs.writeFile(filePath, content, (err) => {
    if (err) {
      return res.status(500).send('Erro ao criar a página.');
    }

    fs.writeFile(metadataPath, JSON.stringify({ title, category }), (err) => {
      if (err) {
        return res.status(500).send('Erro ao salvar a categoria.');
      }
      res.send('Página criada com sucesso.');
    });
  });
});

// Rota para visualizar uma página (GET)
app.get('/pages/:url', (req, res) => {
  const { url } = req.params;
  const filePath = path.join(__dirname, 'pages', `${url}.txt`);

  fs.readFile(filePath, 'utf8', (err, content) => {
    if (err) {
      return res.status(404).send('Página não encontrada.');
    }
    res.send(content);
  });
});

// Rota para criar uma nova página (formulário)
app.get('/create-page', checkAuthentication, (req, res) => {
  res.render('create-page');
});

// Rota para selecionar a página a ser editada (GET)
app.get('/edit-page', checkAuthentication, (req, res) => {
  const pagesDir = path.join(__dirname, 'pages');
  const metadataDir = path.join(__dirname, 'metadata');

  fs.readdir(pagesDir, (err, files) => {
    if (err) {
      return res.status(500).send('Erro ao listar páginas.');
    }

    const pages = files.map(file => {
      const url = path.basename(file, '.txt');
      const metadataPath = path.join(metadataDir, `${url}.json`);
      const metadata = fs.existsSync(metadataPath) ? JSON.parse(fs.readFileSync(metadataPath, 'utf8')) : {};
      return { url, title: metadata.title || url };
    });

    res.render('select-page', { pages });
  });
});

// Rota para editar uma página (GET)
app.get('/edit-page/:url', checkAuthentication, (req, res) => {
  const { url } = req.params;
  const filePath = path.join(__dirname, 'pages', `${url}.txt`);

  fs.readFile(filePath, 'utf8', (err, content) => {
    if (err) {
      return res.status(404).send('Página não encontrada.');
    }
    res.render('edit-page', { url, content });
  });
});

// Rota para editar uma página (POST)
app.post('/edit-page/:url', checkAuthentication, [
  body('content').trim().notEmpty().withMessage('Conteúdo é obrigatório.')
], (req, res) => {
  const { url } = req.params;
  const { content } = req.body;
  const filePath = path.join(__dirname, 'pages', `${url}.txt`);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  fs.writeFile(filePath, content, (err) => {
    if (err) {
      return res.status(500).send('Erro ao editar a página.');
    }
    res.send('Página editada com sucesso.');
  });
});

// Rota para excluir uma página (GET)
app.get('/delete-page', checkAuthentication, (req, res) => {
  const pagesDir = path.join(__dirname, 'pages');
  const metadataDir = path.join(__dirname, 'metadata');

  fs.readdir(pagesDir, (err, files) => {
    if (err) {
      return res.status(500).send('Erro ao listar páginas.');
    }

    const pages = files.map(file => {
      const url = path.basename(file, '.txt');
      const metadataPath = path.join(metadataDir, `${url}.json`);
      const metadata = fs.existsSync(metadataPath) ? JSON.parse(fs.readFileSync(metadataPath, 'utf8')) : {};
      return { url, title: metadata.title || url };
    });

    res.render('delete-page', { pages });
  });
});

// Rota para excluir uma página (POST)
app.post('/delete-page/:url', checkAuthentication, (req, res) => {
  const { url } = req.params;
  const filePath = path.join(__dirname, 'pages', `${url}.txt`);
  const metadataPath = path.join(__dirname, 'metadata', `${url}.json`);

  fs.unlink(filePath, (err) => {
    if (err) {
      return res.status(500).send('Erro ao excluir a página.');
    }

    fs.unlink(metadataPath, (err) => {
      if (err) {
        return res.status(500).send('Erro ao excluir a categoria.');
      }
      res.send('Página excluída com sucesso.');
    });
  });
});

// Rota para a página inicial do site
app.get('/', (req, res) => {
  const pagesDir = path.join(__dirname, 'pages');
  const metadataDir = path.join(__dirname, 'metadata');

  fs.readdir(pagesDir, (err, files) => {
    if (err) {
      return res.status(500).send('Erro ao listar páginas.');
    }

    const categories = {};
    let pending = files.length;

    files.forEach(file => {
      const url = path.basename(file, '.txt');
      const metadataPath = path.join(metadataDir, `${url}.json`);

      fs.readFile(metadataPath, 'utf8', (err, metadata) => {
        if (err) {
          if (--pending === 0) {
            renderPageList();
          }
          return;
        }

        const { category } = JSON.parse(metadata);
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push(`<a href="/pages/${url}">${url}</a>`);

        if (--pending === 0) {
          renderPageList();
        }
      });
    });

    function renderPageList() {
      res.render('index', { categories });
    }
  });
});

// Inicia o servidor
app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
});
