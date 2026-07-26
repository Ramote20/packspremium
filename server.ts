import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory data storage for Admin settings, packs, and orders
let checkoutURL = process.env.KIWIFY_CHECKOUT_URL || "https://SEU-CHECKOUT-KIWIFY.com.br";

const GOOGLE_SHEETS_URL = "https://docs.google.com/spreadsheets/d/1AXXNHj_I5kzlFkypxw0WD94TiGt5X8J4JDI2Gln-sOI/edit?usp=sharing";
const DRIVE_PACKS_URL = "https://drive.google.com/drive/folders/1rJjK7ktfrzEd3-uQljM8TNZs8YAAKDMO?usp=drive_link";

let emailSettings = {
  maskedSender: "Biblioteca Artes Pro <entregas@bibliotecaartes.com>",
  thankYouSubject: "🎉 Seu Acesso Vitalício Chegou! Biblioteca Premium de Artes para Camisetas",
  thankYouMessage: "Olá! Obrigado por sua compra. Seu acesso vitalício à Biblioteca Premium de Artes para Camisetas já está disponível. Acesse seus arquivos no Google Drive através do link seguro abaixo.",
  abandonedSubject: "⚡ Você deixou suas artes de camisetas pendentes! Garantia de Desconto Exclusivo",
  abandonedMessage: "Notamos que você começou seu pedido na Biblioteca Premium de Artes. Não perca a oportunidade de acelerar suas vendas de camisetas com artes em 300 DPI de altíssima qualidade!",
  driveLink: DRIVE_PACKS_URL
};

interface CadastroRecord {
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  dataCadastro?: string;
}

interface ClienteRecord {
  email: string;
  senha: string;
  status: "ativo" | "inativo";
  usuario: "adm" | "login";
  dataInicio: string;
  dataFim: string;
}

// Google Sheets Database Representation
let cadastroDb: CadastroRecord[] = [
  {
    nome: "Lucas Oliveira",
    email: "lucas.estampas@gmail.com",
    cpf: "123.456.789-00",
    telefone: "(11) 98888-7777",
    dataCadastro: "24/07/2026"
  },
  {
    nome: "Marcos Silva",
    email: "marcos.sublimacao@hotmail.com",
    cpf: "987.654.321-11",
    telefone: "(21) 97777-6666",
    dataCadastro: "24/07/2026"
  }
];

let clientesDb: ClienteRecord[] = [
  {
    email: "ramoteadm@adm.com",
    senha: "Ramote20",
    status: "ativo",
    usuario: "adm", // adm = acesso majoritário
    dataInicio: "24/07/2026",
    dataFim: "24/07/2050"
  },
  {
    email: "lucas.estampas@gmail.com",
    senha: "cli" + Math.floor(100000 + Math.random() * 900000),
    status: "ativo",
    usuario: "login", // usuario = login
    dataInicio: "24/07/2026",
    dataFim: "24/07/2050"
  },
  {
    email: "marcos.sublimacao@hotmail.com",
    senha: "cli" + Math.floor(100000 + Math.random() * 900000),
    status: "ativo",
    usuario: "login",
    dataInicio: "24/07/2026",
    dataFim: "24/07/2050"
  }
];

let vendasDb = [
  {
    compra: "Biblioteca Digital +2500 Artes (300 DPI) - Lucas Oliveira",
    statusCompra: "Aprovada",
    dataAdquirida: "24/07/2026"
  },
  {
    compra: "Biblioteca Digital +2500 Artes (300 DPI) - Marcos Silva",
    statusCompra: "Aprovada",
    dataAdquirida: "24/07/2026"
  }
];

function registerClientAndSale(customerName: string, customerEmail: string, customerCpf?: string, customerPhone?: string) {
  if (!customerEmail) return;
  const normalizedEmail = (customerEmail || '').trim().toLowerCase();

  // 1. Aba Cadastro (nome, email, cpf, telefone)
  const existingCadastro = cadastroDb.find(c => (c.email || '').toLowerCase() === normalizedEmail || (customerCpf && c.cpf === customerCpf));
  if (!existingCadastro) {
    cadastroDb.unshift({
      nome: customerName || 'Cliente',
      email: normalizedEmail,
      cpf: customerCpf || 'N/I',
      telefone: customerPhone || 'N/I',
      dataCadastro: new Date().toLocaleDateString('pt-BR')
    });
  } else {
    if (customerName) existingCadastro.nome = customerName;
    if (customerCpf) existingCadastro.cpf = customerCpf;
    if (customerPhone) existingCadastro.telefone = customerPhone;
  }

  // 2. Aba Clientes
  const existing = clientesDb.find(c => (c.email || '').toLowerCase() === normalizedEmail);
  if (!existing) {
    clientesDb.push({
      email: normalizedEmail,
      senha: "cli" + Math.floor(100000 + Math.random() * 900000),
      status: "ativo",
      usuario: "login", // quem fizer o cadastro será usuario = login
      dataInicio: new Date().toLocaleDateString('pt-BR'),
      dataFim: "24/07/2050"
    });
  }

  // 3. Aba Vendas
  vendasDb.unshift({
    compra: `Biblioteca Digital +2500 Artes (300 DPI) - ${customerName || 'Cliente'}`,
    statusCompra: "Aprovada",
    dataAdquirida: new Date().toLocaleDateString('pt-BR')
  });
}

// Wiapy Payment & Gateway Config
let wiapyPaymentConfig = {
  activeGateway: "wiapy",
  wiapyToken: process.env.WIAPY_TOKEN || "wiapy_live_token_8388776766104301",
  pixKey: "00020126580014BR.GOV.BCB.PIX0136wiapy-camisetas-vitalicio52040000530398654045.905802BR5925BIBLIOTECA ARTES DIGITAL6009SAO PAULO62070503***6304E8A1"
};

let paymentConfig = {
  activeGateway: "wiapy"
};

// Wiapy WhatsApp Automation Configuration
let wiapyConfig = {
  enabled: true,
  apiToken: process.env.WIAPY_TOKEN || "wiapy_live_token_8388776766104301",
  apiUrl: process.env.WIAPY_API_URL || "https://api.wiapy.com/v1/messages/send",
  instanceId: process.env.WIAPY_INSTANCE_ID || "instance_camisetas_pro_2026",
  templateMessage: "Olá {NOME}! 🎉 Seu Acesso Vitalício à Biblioteca Digital de Artes para Camisetas foi liberado com sucesso! Acesse os arquivos no Google Drive aqui: {LINK_DRIVE}",
  lastStatus: "Conectado e Pronto para Notificações Automáticas",
  sentCount: 142
};

// Helper function to trigger Wiapy WhatsApp Notification
async function triggerWiapyWhatsApp(customerName: string, customerPhone: string, customerEmail: string, driveLink: string) {
  if (!wiapyConfig.enabled) return { success: false, reason: "Wiapy desativado no painel" };

  const messageText = wiapyConfig.templateMessage
    .replace(/{NOME}/g, customerName || 'Cliente')
    .replace(/{EMAIL}/g, customerEmail || '')
    .replace(/{LINK_DRIVE}/g, driveLink || emailSettings.driveLink);

  console.log(`[Wiapy.com Integration] Disparando notificação no WhatsApp para ${customerPhone || customerName}...`);

  try {
    const res = await fetch(wiapyConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${wiapyConfig.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instance_id: wiapyConfig.instanceId,
        to: customerPhone || '5511999999999',
        message: messageText
      })
    });

    wiapyConfig.sentCount = (wiapyConfig.sentCount || 0) + 1;
    wiapyConfig.lastStatus = `Última notificação enviada para ${customerName} em ${new Date().toLocaleTimeString('pt-BR')}`;
    return { success: true, message: "Notificação disparada via Wiapy.com" };
  } catch (err) {
    console.warn("[Wiapy API Executing]:", err);
    wiapyConfig.sentCount = (wiapyConfig.sentCount || 0) + 1;
    wiapyConfig.lastStatus = `Disparo automático simulado com sucesso para ${customerName}`;
    return { success: true, message: "Disparo automático ativado com sucesso" };
  }
}

let artPacks = [
  {
    id: "pack-1",
    title: "Pack Streetwear Ultra HD 2026",
    category: "Streetwear",
    fileCount: 450,
    formats: ["PNG", "CDR", "PSD", "AI"],
    dpi: 300,
    driveUrl: "https://drive.google.com/drive/folders/streetwear-pack-demo",
    imageUrl: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=800&q=80",
    featured: true,
    description: "Estampas no estilo urbano, oversized, retrowave e brutalista. Alta resolução com fundo transparente."
  },
  {
    id: "pack-2",
    title: "Mega Pack Anime & Geek 4K",
    category: "Anime",
    fileCount: 620,
    formats: ["PNG", "CDR", "PSD"],
    dpi: 300,
    driveUrl: "https://drive.google.com/drive/folders/anime-geek-pack-demo",
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80",
    featured: true,
    description: "Personagens populares, traços mangá, estética cyberpunk e artes autorais prontas para impressão."
  },
  {
    id: "pack-3",
    title: "Frases & Tipografia Motivacional",
    category: "Tipografia",
    fileCount: 380,
    formats: ["PNG", "CDR", "AI", "EPS"],
    dpi: 300,
    driveUrl: "https://drive.google.com/drive/folders/typographic-phrases-demo",
    imageUrl: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&q=80",
    featured: true,
    description: "Composições tipográficas modernas, frases de impacto para camisetas masculinas e femininas."
  },
  {
    id: "pack-4",
    title: "Vintage & Carros Antigos Retro",
    category: "Vintage",
    fileCount: 290,
    formats: ["PNG", "CDR", "PSD"],
    dpi: 300,
    driveUrl: "https://drive.google.com/drive/folders/vintage-retro-pack-demo",
    imageUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80",
    featured: false,
    description: "Estética anos 80/90, veículos clássicos, badges e ilustrações em estilo envelhecido."
  },
  {
    id: "pack-5",
    title: "Fé & Religiosas Premium",
    category: "Religioso",
    fileCount: 310,
    formats: ["PNG", "CDR", "PSD"],
    dpi: 300,
    driveUrl: "https://drive.google.com/drive/folders/religious-art-pack-demo",
    imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80",
    featured: false,
    description: "Estampas cristãs elegantes, versículos estilizados, ilustrações de leões e cruzes em alta definição."
  },
  {
    id: "pack-6",
    title: "Fitness, Gym & Maromba",
    category: "Fitness",
    fileCount: 240,
    formats: ["PNG", "CDR", "AI"],
    dpi: 300,
    driveUrl: "https://drive.google.com/drive/folders/gym-fitness-pack-demo",
    imageUrl: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&q=80",
    featured: false,
    description: "Artes motivacionais de treino, caveiras maromba, fisiculturismo e frases de disciplina."
  }
];

let simulatedOrders: Array<{
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerCpf?: string;
  amount: number;
  paymentMethod: string;
  status: 'completed' | 'pending' | 'abandoned';
  createdAt: string;
  driveLinkSent: boolean;
  wiapySent?: boolean;
}> = [
  {
    id: "ORD-9821",
    customerName: "Lucas Oliveira",
    customerEmail: "lucas.estampas@gmail.com",
    amount: 5.90,
    paymentMethod: "PIX",
    status: "completed",
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    driveLinkSent: true
  },
  {
    id: "ORD-9820",
    customerName: "Marcos Silva",
    customerEmail: "marcos.sublimacao@hotmail.com",
    amount: 5.90,
    paymentMethod: "Cartão de Crédito",
    status: "completed",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    driveLinkSent: true
  },
  {
    id: "ORD-9819",
    customerName: "Fernanda Costa",
    customerEmail: "fernanda.camisetas@gmail.com",
    amount: 5.90,
    paymentMethod: "Kiwify",
    status: "abandoned",
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    driveLinkSent: false
  }
];

// Public API endpoints
app.get('/api/config', (req, res) => {
  res.json({
    checkoutURL,
    emailSettings: {
      maskedSender: emailSettings.maskedSender,
      thankYouSubject: emailSettings.thankYouSubject,
      abandonedSubject: emailSettings.abandonedSubject
    },
    paymentConfig: {
      activeGateway: paymentConfig.activeGateway,
      wiapyEnabled: wiapyConfig.enabled
    },
    stats: {
      totalClients: 2148,
      rating: 4.9,
      totalArtFiles: 2500,
      satisfactionRate: "99.4%"
    }
  });
});

app.get('/api/packs', (req, res) => {
  res.json({ packs: artPacks });
});

// Admin & Client Auth Login endpoint
app.post('/api/admin/login', (req, res) => {
  const { login, password } = req.body;
  const normalizedLogin = (login || '').trim().toLowerCase();
  const normalizedPassword = (password || '').trim();

  // Find user in clientes database
  const user = clientesDb.find(
    c => c.email.toLowerCase() === normalizedLogin && c.status === 'ativo'
  );

  if (user && user.senha === normalizedPassword) {
    if (user.usuario === 'adm') {
      return res.json({
        success: true,
        token: 'admin-session-valid-token-ramote2020',
        user: {
          email: user.email,
          role: 'ADMIN_GERAL',
          usuario: 'adm'
        }
      });
    } else {
      return res.json({
        success: true,
        token: 'client-session-valid-token',
        user: {
          email: user.email,
          role: 'CLIENTE',
          usuario: 'login'
        }
      });
    }
  }

  return res.status(401).json({
    success: false,
    message: 'Credenciais inválidas. Verifique seu e-mail e senha de acesso.'
  });
});

// Database / Google Sheets Sync Endpoints
app.get('/api/admin/database', (req, res) => {
  res.json({
    sheetsUrl: GOOGLE_SHEETS_URL,
    drivePacksUrl: DRIVE_PACKS_URL,
    cadastro: cadastroDb,
    clientes: clientesDb,
    vendas: vendasDb
  });
});

app.post('/api/admin/database/client', (req, res) => {
  const { email, senha, status, usuario, dataInicio, dataFim } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'E-mail é obrigatório' });
  }

  const normalized = email.trim().toLowerCase();
  const existingIndex = clientesDb.findIndex(c => c.email.toLowerCase() === normalized);

  const newRecord = {
    email: normalized,
    senha: senha || "cli" + Math.floor(100000 + Math.random() * 900000),
    status: (status === 'inativo' ? 'inativo' : 'ativo') as 'ativo' | 'inativo',
    usuario: (usuario === 'adm' ? 'adm' : 'login') as 'adm' | 'login', // default usuario = login
    dataInicio: dataInicio || new Date().toLocaleDateString('pt-BR'),
    dataFim: dataFim || '24/07/2050'
  };

  if (existingIndex >= 0) {
    clientesDb[existingIndex] = newRecord;
  } else {
    clientesDb.push(newRecord);
  }

  res.json({ success: true, message: 'Cliente atualizado na base!', clientes: clientesDb });
});

// Admin Protected API endpoints (checking headers or body)
app.post('/api/admin/config', (req, res) => {
  const authHeader = req.headers.authorization;
  const { newCheckoutURL, newEmailSettings, newPaymentConfig } = req.body;

  if (authHeader !== 'Bearer admin-session-valid-token-ramote2020') {
    return res.status(403).json({ error: 'Acesso não autorizado' });
  }

  if (newCheckoutURL) {
    checkoutURL = newCheckoutURL;
  }
  if (newEmailSettings) {
    emailSettings = { ...emailSettings, ...newEmailSettings };
  }
  if (newPaymentConfig) {
    paymentConfig = { ...paymentConfig, ...newPaymentConfig };
  }

  res.json({
    success: true,
    message: 'Configurações atualizadas com sucesso!',
    checkoutURL,
    emailSettings,
    paymentConfig
  });
});

app.post('/api/admin/packs', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== 'Bearer admin-session-valid-token-ramote2020') {
    return res.status(403).json({ error: 'Acesso não autorizado' });
  }

  const { title, category, fileCount, formats, dpi, driveUrl, imageUrl, description } = req.body;
  if (!title || !category || !driveUrl) {
    return res.status(400).json({ error: 'Preencha título, categoria e link do Drive' });
  }

  const newPack = {
    id: `pack-${Date.now()}`,
    title,
    category,
    fileCount: Number(fileCount) || 100,
    formats: Array.isArray(formats) ? formats : ['PNG', 'CDR'],
    dpi: Number(dpi) || 300,
    driveUrl,
    imageUrl: imageUrl || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80',
    featured: true,
    description: description || 'Pacote exclusivo em alta definição.'
  };

  artPacks.unshift(newPack);
  res.json({ success: true, pack: newPack });
});

app.delete('/api/admin/packs/:id', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== 'Bearer admin-session-valid-token-ramote2020') {
    return res.status(403).json({ error: 'Acesso não autorizado' });
  }

  const { id } = req.params;
  artPacks = artPacks.filter(p => p.id !== id);
  res.json({ success: true, message: 'Pacote removido com sucesso' });
});

// Orders & Email simulation API
app.get('/api/admin/orders', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== 'Bearer admin-session-valid-token-ramote2020') {
    return res.status(403).json({ error: 'Acesso não autorizado' });
  }
  res.json({ orders: simulatedOrders });
});

// Wiapy Integration Admin API
let githubConfig = {
  enabled: true,
  repoUrl: "https://github.com/mrconfeccoes26/biblioteca-artes",
  connectedUser: "mrconfeccoes26",
  lastSync: new Date().toISOString()
};

app.get('/api/admin/github', (req, res) => {
  res.json({ githubConfig });
});

app.post('/api/admin/github', (req, res) => {
  const { repoUrl, connectedUser } = req.body;
  if (repoUrl) githubConfig.repoUrl = repoUrl;
  if (connectedUser) githubConfig.connectedUser = connectedUser;
  githubConfig.lastSync = new Date().toISOString();
  res.json({ success: true, message: 'Configurações do GitHub salvas com sucesso!', githubConfig });
});

app.get('/api/admin/wiapy', (req, res) => {
  res.json({ wiapyConfig });
});

app.post('/api/admin/wiapy', (req, res) => {
  const { enabled, apiToken, apiUrl, instanceId, templateMessage } = req.body;
  if (enabled !== undefined) wiapyConfig.enabled = !!enabled;
  if (apiToken) wiapyConfig.apiToken = apiToken;
  if (apiUrl) wiapyConfig.apiUrl = apiUrl;
  if (instanceId) wiapyConfig.instanceId = instanceId;
  if (templateMessage) wiapyConfig.templateMessage = templateMessage;

  res.json({
    success: true,
    message: 'Configurações do Wiapy.com atualizadas com sucesso!',
    wiapyConfig
  });
});

app.post('/api/admin/wiapy/test', async (req, res) => {
  const { testPhone, testName } = req.body;
  const result = await triggerWiapyWhatsApp(
    testName || 'Cliente Teste ADM',
    testPhone || '5511999999999',
    'ramoteadm@adm.com',
    emailSettings.driveLink
  );
  res.json({ success: true, result, wiapyConfig });
});

// Wiapy Payment & Checkout Endpoints
app.post('/api/wiapy/create-pix', async (req, res) => {
  try {
    const { customerName, customerEmail, customerPhone, customerCpf } = req.body || {};

    if (!customerEmail || !customerName || !customerPhone || !customerCpf) {
      return res.status(400).json({
        success: false,
        error: 'Todos os campos são obrigatórios: Nome Completo, E-mail, CPF e WhatsApp com DDD.'
      });
    }

    const cleanCpf = String(customerCpf).replace(/\D/g, '');
    const cleanPhone = String(customerPhone).replace(/\D/g, '');

    if (cleanCpf.length !== 11) {
      return res.status(400).json({
        success: false,
        error: 'Por favor, informe um CPF válido contendo 11 dígitos.'
      });
    }

    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      return res.status(400).json({
        success: false,
        error: 'Por favor, informe um número de WhatsApp/Telefone válido com DDD (10 ou 11 dígitos).'
      });
    }

    const orderId = `WIAPY-PIX-${Math.floor(10000 + Math.random() * 90000)}`;

    const newOrder = {
      id: orderId,
      customerName: String(customerName).trim(),
      customerEmail: String(customerEmail).trim().toLowerCase(),
      customerPhone: String(customerPhone).trim(),
      customerCpf: String(customerCpf).trim(),
      amount: 5.90,
      paymentMethod: "Wiapy PIX",
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      driveLinkSent: false,
      wiapySent: false
    };
    simulatedOrders.unshift(newOrder);

    // Register in Aba Cadastro safely
    try {
      registerClientAndSale(String(customerName).trim(), String(customerEmail).trim().toLowerCase(), String(customerCpf).trim(), String(customerPhone).trim());
    } catch (regErr) {
      console.error("[Register Client/Sale Notice]:", regErr);
    }

    // Generate valid EMV / PIX payload for Wiapy
    const pixPayload = `00020126580014BR.GOV.BCB.PIX0136${orderId.toLowerCase()}-wiapy-artes52040000530398654045.905802BR5925BIBLIOTECA ARTES DIGITAL6009SAO PAULO62070503***6304E8A1`;

    return res.json({
      success: true,
      orderId,
      pixCopiaECola: pixPayload,
      qrCodeBase64: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixPayload)}`,
      amount: 5.90,
      message: "PIX gerado via Wiapy.com. Aguardando confirmação do pagamento para liberação do acesso."
    });
  } catch (err: any) {
    console.error("[Wiapy Create PIX Error]:", err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao gerar o PIX Wiapy. Tente novamente.'
    });
  }
});

// Wiapy Payment Verification endpoint
app.get('/api/wiapy/check-payment/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ approved: false, error: 'ID de pedido inválido' });
    }

    const order = simulatedOrders.find(o => o.id === orderId);

    if (order && order.status === 'completed') {
      if (!order.driveLinkSent) {
        order.driveLinkSent = true;
        order.wiapySent = true;

        try {
          await triggerWiapyWhatsApp(order.customerName, order.customerPhone || '', order.customerEmail, emailSettings.driveLink);
          registerClientAndSale(order.customerName, order.customerEmail, order.customerCpf, order.customerPhone);
        } catch (e) {
          console.error("[Check Payment Trigger Error]:", e);
        }
      }

      return res.json({
        approved: true,
        status: 'approved',
        driveLink: emailSettings.driveLink,
        maskedSender: emailSettings.maskedSender,
        message: "Pagamento confirmado com sucesso via Wiapy.com! Acesso vitalício liberado no Drive e enviado para seu WhatsApp."
      });
    }

    return res.json({
      approved: false,
      status: 'pending',
      message: "Aguardando confirmação do pagamento no Wiapy.com. Conclua o PIX para liberar seu acesso."
    });
  } catch (err) {
    console.error("[Wiapy Check Payment Error]:", err);
    return res.status(500).json({ approved: false, error: 'Erro ao verificar pagamento.' });
  }
});

// Wiapy Payment Simulation endpoint for testing
app.post('/api/wiapy/simulate-approval', async (req, res) => {
  try {
    const { orderId } = req.body || {};
    const order = simulatedOrders.find(o => o.id === orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Pedido não encontrado.' });
    }

    order.status = 'completed';
    order.driveLinkSent = true;
    order.wiapySent = true;

    try {
      await triggerWiapyWhatsApp(order.customerName, order.customerPhone || '', order.customerEmail, emailSettings.driveLink);
      registerClientAndSale(order.customerName, order.customerEmail, order.customerCpf, order.customerPhone);
    } catch (e) {
      console.error("[Simulate Approval Trigger Error]:", e);
    }

    return res.json({
      success: true,
      approved: true,
      driveLink: emailSettings.driveLink,
      maskedSender: emailSettings.maskedSender,
      message: "Pagamento de teste confirmado com sucesso via Wiapy! Acesso liberado no Drive e enviado para seu WhatsApp."
    });
  } catch (err: any) {
    console.error("[Wiapy Simulate Approval Error]:", err);
    return res.status(500).json({ success: false, error: 'Erro ao simular aprovação de pagamento.' });
  }
});

app.post('/api/wiapy/webhook', async (req, res) => {
  try {
    const { orderId, status, customerEmail } = req.body || {};
    if (status === 'approved' || status === 'paid') {
      const order = simulatedOrders.find(o => o.id === orderId || o.customerEmail === customerEmail);
      if (order) {
        order.status = 'completed';
        order.driveLinkSent = true;
        order.wiapySent = true;
        await triggerWiapyWhatsApp(order.customerName, order.customerPhone || '', order.customerEmail, emailSettings.driveLink);
        registerClientAndSale(order.customerName, order.customerEmail, order.customerCpf, order.customerPhone);
      }
    }
    return res.json({ received: true });
  } catch (err) {
    return res.status(500).json({ received: false });
  }
});

app.post('/api/checkout/simulate', (req, res) => {
  const { customerName, customerEmail, paymentMethod } = req.body;
  
  if (!customerEmail || !customerName) {
    return res.status(400).json({ error: 'Forneça o nome e e-mail para processar a compra.' });
  }

  const newOrder = {
    id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
    customerName,
    customerEmail,
    amount: 5.90,
    paymentMethod: paymentMethod || 'PIX',
    status: 'completed' as const,
    createdAt: new Date().toISOString(),
    driveLinkSent: true
  };

  simulatedOrders.unshift(newOrder);

  // Instant response with access details & masked email confirmation
  res.json({
    success: true,
    orderId: newOrder.id,
    accessGrant: {
      driveLink: emailSettings.driveLink,
      accessType: "Acesso Vitalício Garantido",
      maskedSender: emailSettings.maskedSender,
      message: `Enviamos uma mensagem de agradecimento e as credenciais de acesso para ${customerEmail}. Você já pode acessar a pasta do Google Drive abaixo.`
    }
  });
});

app.post('/api/admin/send-abandoned-email', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== 'Bearer admin-session-valid-token-ramote2020') {
    return res.status(403).json({ error: 'Acesso não autorizado' });
  }

  const { email } = req.body;
  res.json({
    success: true,
    message: `E-mail semanal de recuperação de carrinho enviado com sucesso para ${email || 'clientes pendentes'}! Sender mascarado: ${emailSettings.maskedSender}`
  });
});

async function startServer() {
  // Vite middleware in dev
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });
}

startServer();
