const { Client, MessageMedia, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const { phoneNumberFormatter } = require('./helpers/formatter');
const axios = require('axios');
const port = process.env.PORT || 8000;

const app = express();
const server = http.createServer(app);

const sessions = [];
const SESSIONS_FILE = './whatsapp-sessions.json';

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

app.get('/', (req, res) => {});



const createSessionsFileIfNotExists = function() {
  if (!fs.existsSync(SESSIONS_FILE)) {
    try {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
      console.log('Sessions file created successfully.');
    } catch(err) {
      console.log('Failed to create sessions file: ', err);
    }
  }
}

const setSessionsFile = function(sessions) {
  fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions), function(err) {
    if (err) {
      console.log(err);
    }
  });
}

const getSessionsFile = function() {
  return JSON.parse(fs.readFileSync(SESSIONS_FILE));
}

const createSession = function(id, description) {
  console.log('Creating session: ' + id);
  const client = new Client({
    restartOnAuthFail: true,
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // <- this one doesn't works in Windows
        '--disable-gpu'
      ],
    },
    authStrategy: new LocalAuth({
      clientId: id
    })
  });

  client.initialize();

  client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
  });

  client.on('ready', () => {
    io.emit('ready', { id: id });
    io.emit('message', { id: id, text: 'Whatsapp is ready!' });

    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
    savedSessions[sessionIndex].ready = true;
    setSessionsFile(savedSessions);
  });

  client.on('authenticated', () => {
    io.emit('authenticated', { id: id });
    io.emit('message', { id: id, text: 'Whatsapp is authenticated!' });
  });

  client.on('auth_failure', function() {
    io.emit('message', { id: id, text: 'Auth failure, restarting...' });
  });

  client.on('disconnected', (reason) => {
    io.emit('message', { id: id, text: 'Whatsapp is disconnected!' });
    client.destroy();
    client.initialize();

    // Menghapus pada file sessions
    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
    savedSessions.splice(sessionIndex, 1);
    setSessionsFile(savedSessions);

    io.emit('remove-session', id);
  });

  // Tambahkan client ke sessions
  sessions.push({
    id: id,
    description: description,
    client: client
  });

  // Menambahkan session ke file
  const savedSessions = getSessionsFile();
  const sessionIndex = savedSessions.findIndex(sess => sess.id == id);

  if (sessionIndex == -1) {
    savedSessions.push({
      id: id,
      description: description,
      ready: false,
    });
    setSessionsFile(savedSessions);
  }
}

const init = function(socket) {
  const savedSessions = getSessionsFile();

  if (savedSessions.length > 0) {
    if (socket) {
      socket.emit('init', savedSessions);
    } else {
      savedSessions.forEach(sess => {
        createSession(sess.id, sess.description);
      });
    }
  }
}

// Socket IO
io.on('connection', function(socket) {
  init(socket);

  socket.on('create-session', function(data) {
    console.log('Create session: ' + data.id);
    createSession(data.id, data.description);
  });
});

// io.on('connection', function(socket) {
//   socket.emit('message', 'Connecting...');

//   client.on('qr', (qr) => {
//     console.log('QR RECEIVED', qr);
//     qrcode.toDataURL(qr, (err, url) => {
//       socket.emit('qr', url);
//       socket.emit('message', 'QR Code received, scan please!');
//     });
//   });

//   client.on('ready', () => {
//     socket.emit('ready', 'Whatsapp is ready!');
//     socket.emit('message', 'Whatsapp is ready!');
//   });

//   client.on('authenticated', (session) => {
//     socket.emit('authenticated', 'Whatsapp is authenticated!');
//     socket.emit('message', 'Whatsapp is authenticated!');
//     console.log('AUTHENTICATED', session);
//     sessionCfg = session;
//     fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function(err) {
//       if (err) {
//         console.error(err);
//       }
//     });
//   });

//   client.on('auth_failure', function(session) {
//     socket.emit('message', 'Auth failure, restarting...');
//   });

//   client.on('disconnected', (reason) => {
//     socket.emit('message', 'Whatsapp is disconnected!');
//     fs.unlinkSync(SESSION_FILE_PATH, function(err) {
//         if(err) return console.log(err);
//         console.log('Session file deleted!');
//     });
//     client.destroy();
//     client.initialize();
//   });
// });

// Send message

app.post('/send-message', (req, res) => {
  const sender = req.body.sender;
  const number = phoneNumberFormatter(req.body.number);
  const message = req.body.message;

  const client = sessions.find(sess => sess.id == sender).client;

  client.sendMessage(number, message).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});

server.listen(port, function() {
  console.log('App running on *: ' + port);
});

createSessionsFileIfNotExists();

init();