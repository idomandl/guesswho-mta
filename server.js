// server.js

// const https = require('https');
// const fs = require('fs');
// const WebSocket = require('ws');

// // Load your SSL certificate and key files
// const serverOptions = {
//     cert: fs.readFileSync('path/to/certificate.pem'),
//     key: fs.readFileSync('path/to/private-key.pem'),
// };

// // Create an HTTPS server
// const server = https.createServer(serverOptions);

// // Create WebSocket server on top of the HTTPS server
// const wss = new WebSocket.Server({ server });

// wss.on('connection', (ws) => {
//     console.log('Client connected via WSS');
//     ws.on('message', (message) => {
//         console.log('Received message:', message);
//         ws.send('Hello, you are connected over a secure WebSocket!');
//     });
// });

// server.listen(443, () => {
//     console.log('Server is running on https://localhost:443');
// });


const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const https = require('https');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
//////////////////////////////////////////////////////////////////
const serverOptions = {
      cert: fs.readFileSync('ssl/server.cert'),
      key: fs.readFileSync('ssl/server.key'),
};

const app = express();

const server = https.createServer(serverOptions, app);

// Create WebSocket server on top of the HTTPS server
const wss = new WebSocket.Server({ server });





const port = 443;

const clients = new Map();

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'static')));
app.use((req, res, next) => {
  if (req.secure) {
      next(); // request was via https, so do nothing
  } else {
      res.redirect('https://' + req.headers.host + req.url); // redirect to https
  }
});

let users = [];
let games = [];
const cardsData = JSON.parse(fs.readFileSync('players.json', 'utf8'));
console.log('Cards data loaded:', cardsData);
const waiting_gifsData = JSON.parse(fs.readFileSync('waiting_gifs.json', 'utf-8'));
console.log('waitinga gifs data loaded:', waiting_gifsData);

// Load users from users.json
const loadUsers = () => {
  try {
    const data = fs.readFileSync('users.json', 'utf8');
    users = JSON.parse(data);
    console.log('Users data loaded:', users);
  } catch (error) {
    console.log('No users file found, starting with an empty users list');
  }
};

// Save users to users.json
const saveUsers = () => {
  fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
  console.log('Users data saved');
};

loadUsers();

// Helper function to generate a JWT token
const generateToken = (user) => {
  return jwt.sign({ username: user.username }, 'your_secret_key', { expiresIn: '1h' });
};

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) {
    console.log('Token is required');
    return res.status(403).send('Token is required.');
  }

  jwt.verify(token, 'your_secret_key', (err, decoded) => {
    if (err) {
      console.log('Failed to authenticate token:', err);
      return res.status(500).send('Failed to authenticate token.');
    }
    req.user = decoded;
    next();
  });
};

// Part 1: User Registration and Login
// Register user
app.post('/register', (req, res) => {
  console.log('Register request received:', req.body);

  const { username, password } = req.body;

  const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{8,}$/;
  if (!passwordRegex.test(password)) {
    console.log('Invalid password format');
    return res.status(400).send('Password must be at least 8 characters long and include one digit, one special character, one uppercase, and one lowercase letter.');
  }

  const hashedPassword = bcrypt.hashSync(password, 8);
  users.push({ username, password: hashedPassword });
  saveUsers();

  console.log('User registered:', username);
  res.status(201).send('User registered successfully');
});

// Login user
app.post('/login', (req, res) => {
  console.log('Login request received:', req.body);

  const { username, password } = req.body;

  const user = users.find(u => u.username === username);
  if (!user) {
    console.log('User not found:', username);
    return res.status(404).send('User not found.');
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password);
  if (!isPasswordValid) {
    console.log('Invalid password for user:', username);
    return res.status(401).send('Invalid password.');
  }

  const token = generateToken(user);
  console.log('User logged in:', username);
  res.status(200).send({ auth: true, token });
});

// Guest access
app.post('/guest', (req, res) => {
  console.log('Guest access requested');

  const token = jwt.sign({ guest: true }, 'your_secret_key', { expiresIn: '1h' });
  res.status(200).send({ auth: true, token });
  console.log('Guest token generated');
});

// Part 2: Game Logic
// Start or join a public match
app.post('/public-match', verifyToken, (req, res) => {
  console.log('Public match request received from user:', req.user);

  let game = games.find(g => g.isPublic && g.players.length === 1);

  if (game) {
    game.players.push(req.user);
    game.board = generateGameBoard();
    game.whoCards = {
      player1: { username: game.players[0].username, ...selectWhoCard(game.board) },
      player2: { username: game.players[1].username, ...selectWhoCard(game.board) }
    };
    game.currentTurn = game.players[0].username;
    game.currentAction = 'question';
    console.log('Joined existing public match:', game);

    notifyPlayers(game);
    res.status(200).send(game);
  } else {
    game = {
      id: games.length + 1,
      players: [req.user],
      board: null,
      whoCards: null,
      currentTurn: null,
      currentAction: 'question',
      isPublic: true
    };
    games.push(game);
    console.log('Created new public match:', game);
    res.status(201).send(game);
  }
});




// Play with a friend
app.post('/play-friend', verifyToken, (req, res) => {
  console.log('Play friend request received:', req.body);

  const { action, gameId } = req.body;
  const player = req.user;

  if (action === 'create') {
    const gameCode = Math.random().toString(36).substr(2, 5).toUpperCase();
    const game = {
      id: games.length + 1,
      players: [player],
      board: null,
      whoCards: null,
      currentTurn: null,
      currentAction: 'question',
      isPublic: false,
      gameCode
    };

    games.push(game);
    console.log('Game created with code:', gameCode);
    res.status(201).send(game);
  } else if (action === 'join') {
    const game = games.find(g => g.gameCode === gameId);
    if (!game) {
      console.log('Game not found with code:', gameId);
      return res.status(404).send('Game not found.');
    }

    game.players.push(player);
    game.board = generateGameBoard();
    game.whoCards = {
      player1: { username: game.players[0].username, ...selectWhoCard(game.board) },
      player2: { username: game.players[1].username, ...selectWhoCard(game.board) }
    };
    game.currentTurn = game.players[0].username;
    game.currentAction = 'question';
    console.log('Player joined game with code:', gameId);

    notifyPlayers(game);
    res.status(200).send(game);
  }
});

// Generate game board
const generateGameBoard = () => {
  console.log('Generating game board');

  const board = [];
  const shuffledCards = shuffle(cardsData);
  for (let i = 0; i < 25; i++) {
    board.push(shuffledCards[i]);
  }

  console.log('Game board generated:', board);
  return board;
};

// Select a "who?" card
const selectWhoCard = (board) => {
  const index = Math.floor(Math.random() * board.length);
  return board[index];
};

// Shuffle function
const shuffle = (array) => {
  console.log('Shuffling cards');

  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

// Notify players
const notifyPlayers = (game) => {
  game.players.forEach(player => {
    const ws = clients.get(player.username);
    if (ws) {
      console.log(`Notifying player ${player.username}`);
      ws.send(JSON.stringify({ type: 'start-game', game }));
    }
  });
};

// Handle incoming WebSocket messages
const handleWebSocketMessage = (ws, message) => {
  const data = JSON.parse(message);
  console.log('Received WebSocket message:', data);
  if (data.type === 'waiting-gifs'){
    const playerWs = clients.get(data.username);
    playerWs.send(JSON.stringify({type:'waiting-gifs',gifs:waiting_gifsData.gifs}));
  }
  if (data.type === 'chat-question'|| data.type === 'chat-answer'  || data.type === 'guess') {
    const game = games.find(g => g.players.some(p => p.username === data.username));
    if (game) {
      game.players.forEach(player => {
        const playerWs = clients.get(player.username);
        if (playerWs) {
          playerWs.send(JSON.stringify(data));
        }
      });

      if (data.type === 'guess') {
        const opponent = game.players.find(p => p.username !== data.username);
        const whoCard = game.whoCards[`player${game.players.indexOf(opponent) + 1}`];
        if (whoCard.name === data.cardName) {
          game.players.forEach(player => {
            const playerWs = clients.get(player.username);
            if (playerWs) {
              playerWs.send(JSON.stringify({ type: 'game-over', winner: data.username }));
            }
          });
        } else {
          game.players.forEach(player => {
            const playerWs = clients.get(player.username);
            if (playerWs) {
              playerWs.send(JSON.stringify({ type: 'guess-result', username: data.username, cardName: data.cardName, message: `tried to guess ${data.cardName}`}));
            }
          });
        }
      }
    }
  }
};

// WebSocket server
wss.on('connection', (ws, req) => {
  const username = req.headers['sec-websocket-protocol'];
  if (username) {
    console.log(`WebSocket connection established for ${username}`);
    clients.set(username, ws);
    ws.on('message', (message) => handleWebSocketMessage(ws, message));
    ws.on('close', () => {
      console.log(`WebSocket connection closed for ${username}`);
      clients.delete(username);
    });
  }
});




// Upgrade HTTP server to WebSocket server
server.listen(443, () => {
  console.log('Server is running on https://localhost:443');
});


