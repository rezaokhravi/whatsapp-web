const fs = require("fs");
const qrcode = require('qrcode-terminal');
const { Client,LegacySessionAuth,LocalAuth,NoAuth } = require("whatsapp-web.js");

// Path where the session data will be stored
const SESSION_FILE_PATH = "./session.json";

// Load the session data if it has been previously saved
let sessionData;
if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionData = require(SESSION_FILE_PATH);
}

// Use the saved values
const client = new Client({
  authStrategy: new LocalAuth({clientId:"client-one",dataPath:sessionData}),
  puppeteer: {
    args: ["--no-sandbox"],
    executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  }
});


// Save session values to the file upon successful auth
client.on("authenticated", (session) => {
  console.log('session:::',session);
/*
  sessionData = session;
  
  fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), (err) => {
    if (err) {
      console.error('err:::',err);
    }
  });
  */
});


client.on("qr", (qr) => {
  console.log("QR RECEIVED", qr);
  qrcode.generate(qr, {small: true});
});

client.on("ready", () => {
  console.log("Client is ready!");
});



client.initialize();
