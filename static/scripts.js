const apiUrl = 'https://guess-who-mta-deploy-2e95bf2a8b04.herokuapp.com:'+ (process.env.PORT|| '443');
let ws;

const login = async () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    console.log('Login attempt:', username);

    try {
        const response = await fetch(`${apiUrl}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (data.auth) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', username);
            console.log('Login successful:', username);
            connectWebSocket(username);
            showGameOptions();
        } else {
            console.log('Login failed:', data);
            alert('Login failed');
        }
    } catch (error) {
        console.error('Error during login:', error);
    }
};

const register = async () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    console.log('Register attempt:', username);

    try {
        const response = await fetch(`${apiUrl}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.status === 201) {
            console.log('Register successful:', username);
            alert('Registered successfully');
        } else {
            const error = await response.text();
            console.log('Register failed:', error);
            alert('Registration failed');
        }
    } catch (error) {
        console.error('Error during registration:', error);
    }
};

const guest = async () => {
    console.log('Guest access attempt');

    try {
        const response = await fetch(`${apiUrl}/guest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();
        if (data.auth) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', 'guest');
            console.log('Guest access successful');
            connectWebSocket('guest');
            showGameOptions();
        } else {
            console.log('Guest access failed:', data);
            alert('Guest access failed');
        }
    } catch (error) {
        console.error('Error during guest access:', error);
    }
};

const connectWebSocket = (username) => {
    console.log(`Connecting WebSocket for ${username}`);
    ws = new WebSocket(`wss://localhost:443`, username);

    ws.onopen = () => {
        console.log('WebSocket connection opened');
        ws.send(JSON.stringify({type:'waiting-gifs','username':username}));
    };

    ws.onmessage = (event) => {
        console.log('WebSocket message received:', event.data);
        const message = JSON.parse(event.data);
        if (message.type==='waiting-gifs'){
            console.log('setting waiting gifs');
            localStorage.setItem("waiting_gifs", JSON.stringify(message.gifs));
        }
        else if (message.type === 'start-game') {
            console.log('Game starting:', message.game);
            showGame(message.game);
            displayBoard(message.game.board);
            displayWhoCard(message.game.whoCards);
            localStorage.setItem('game', JSON.stringify(message.game));
            Asking();
        } else if (message.type === 'chat-question' || message.type === 'guess-result') {
            console.log('Chat message received:', message);
            displayMessage(message);
            const username = localStorage.getItem('username');
            if( username !== message.username){
                if (message.type === 'chat-question'){
                    const game = JSON.parse(localStorage.getItem('game'));
                    game.currentAction = 'answer';
                    localStorage.setItem('game', JSON.stringify(game));
                    Answering();
                }
                else {
                    Asking();
                }
            }
        } else if (message.type === 'chat-answer') {
            console.log('Chat message received:', message);
            displayMessage(message);
            const username = localStorage.getItem('username');
            if (message.username !== username){
                const game = JSON.parse(localStorage.getItem('game'));
                game.currentAction = 'question';
                localStorage.setItem('game', JSON.stringify(game));
                OtherAsking();
            }
        } 
        else if (message.type === 'game-over') {
            console.log('Game over:', message.winner);
            alert(`Game over! Winner: ${message.winner}`);
            document.getElementById('app').style.display = 'block';
            document.getElementById('game-app').style.display = 'none';
            showGameOptions();
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('WebSocket connection closed');
    };
};



const showGameOptions = () => {
    console.log('Displaying game options');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('game-options').style.display = 'block';
    document.getElementById('game').style.display = 'none';
};

const showGame = (game) => {
    console.log('Displaying game interface');
    document.getElementById('game-options').style.display = 'none';
    document.getElementById('waiting-page').style.display = 'none';
    document.getElementById('game').style.display = 'block';
    document.getElementById('app').style.display = 'none';
    document.getElementById('game-app').style.display = 'block';
    console.log(`show game(game.currentTurn): ${game.currentTurn}`);
    document.getElementById('current-turn').textContent = `Current Turn: ${game.currentTurn}`;
    updateTurn(game.currentTurn);
};

// Function to start a public match
const startPublicMatch = async () => {
    const token = localStorage.getItem('token');
    console.log('Starting public match');

    try {
        const response = await fetch(`${apiUrl}/public-match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': token }
        });

        const game = await response.json();
        console.log('Public match response:', game);
        if (game.players.length === 2) {
            showGame(game);
            displayBoard(game.board);
            displayWhoCard(game.whoCards);
            localStorage.setItem('game', JSON.stringify(game));
            OtherAsking();
        } else {
            displayWaitingPage();
            console.log('Waiting for another player to join the public match');
            alert('Waiting for another player to join the public match');
        }
    } catch (error) {
        console.error('Error starting public match:', error);
    }
};

const displayWaitingPage = () => {
    document.getElementById('game-options').style.display = 'none';
    document.getElementById('waiting-page').style.display = 'block';
    const waiting_gif = document.createElement('img');
    const username = localStorage.getItem('username');
    const gifs_names = JSON.parse(localStorage.getItem("waiting_gifs"));
    console.log(gifs_names);
    waiting_gif.src = `images/waiting_page_gifs/${gifs_names[Math.floor(Math.random()*gifs_names.length)]}`;
    document.getElementById('waiting-page').appendChild(waiting_gif);  
}

// Function to create or join a game with a friend
const playFriend = async (action, gameId) => {
    const token = localStorage.getItem('token');
    console.log(`${action} game with friend, gameId: ${gameId}`);

    try {
        const response = await fetch(`${apiUrl}/play-friend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': token },
            body: JSON.stringify({ action, gameId })
        });

        const game = await response.json();
        console.log(`${action} game response:`, game);
        if (game.players.length === 2) {
            showGame(game);
            displayBoard(game.board);
            displayWhoCard(game.whoCards);
        } else {
            console.log('Waiting for friend to join the game');
            alert('Waiting for friend to join the game');
        }
    } catch (error) {
        console.error(`Error during ${action} game:`, error);
    }
};

// Function to display the game board
const displayBoard = (board) => {
    console.log('Displaying game board:', board);

    const boardElement = document.getElementById('board');
    boardElement.innerHTML = '';
    board.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        
        const imgElement = document.createElement('img');
        imgElement.src = `images/card_images/${card.image}`;
        imgElement.alt = card.name;

        const cardName = document.createElement('div');
        cardName.className = 'card-name';
        cardName.textContent = card.name;
        cardElement.appendChild(imgElement);
        cardElement.appendChild(cardName);
        document.getElementById('board').appendChild(cardElement);
    });
};

// Function to display the "who?" card
const displayWhoCard = (whoCards) => {
    const username = localStorage.getItem('username');
    const whoCard = whoCards.player1.username === username ? whoCards.player1 : whoCards.player2;
    const whoCardElement = document.createElement('div');
    whoCardElement.className = 'card';
    
    const imgElement = document.createElement('img');
    imgElement.src = `images/card_images/${whoCard.image}`;
    imgElement.alt = `Who? ${whoCard.name}`;
    
    const cardName = document.createElement('div');
    cardName.className = 'card-name';
    cardName.textContent = `Who? ${whoCard.name}`;
    
    whoCardElement.appendChild(imgElement);
    whoCardElement.appendChild(cardName);
    document.getElementById('who-card').innerHTML = ''; // Clear previous card
    document.getElementById('who-card').appendChild(whoCardElement);
};

// Function to send a message
const sendMessage = () => {
    const message = document.getElementById('message').value;
    const username = localStorage.getItem('username');
    const game = JSON.parse(localStorage.getItem('game'));
    const chatMessage = { type: `chat-${game.currentAction}`, username, message };
    console.log('Sending message:', chatMessage);

    ws.send(JSON.stringify(chatMessage));
    document.getElementById('message').value = '';
    const otherUsername = game.players[0].username === username ? game.players[1].username : game.players[0].username;
    if (game.currentAction === 'question'){
        game.currentAction = 'answer';
        localStorage.setItem('game',JSON.stringify(game));
        OtherAnswering();
    } else if (game.currentAction === 'answer'){
        game.currentAction = 'question';
        localStorage.setItem('game',JSON.stringify(game));
        Asking();
    } else {
        console.log('error in sendMessage');
    }
};

// Function to make a guess
const guess = () => {
    const cardName = document.getElementById('guess').value;
    const username = localStorage.getItem('username');
    const guessMessage = { type: 'guess', username, cardName };
    console.log('Making a guess:', guessMessage);

    ws.send(JSON.stringify(guessMessage));
    document.getElementById('guess').value = '';
    const game = JSON.parse(localStorage.getItem('game'));
    const otherUsername = game.players[0].username === username ? game.players[1].username : game.players[0].username;
    OtherAsking();
};

// Function to display a chat message
const displayMessage = (chatMessage) => {
    const chatElement = document.getElementById('chat');
    const messageElement = document.createElement('div');
    messageElement.textContent = `${chatMessage.username}: ${chatMessage.message}`;
    chatElement.appendChild(messageElement);
    chatElement.scrollTop = chatElement.scrollHeight; // Scroll to the bottom
};

const updateTurn = (gameMessageTurn) => {
    console.log(`update turn: ${gameMessageTurn}` );
    const username = localStorage.getItem('username');
    const isMyTurn = gameMessageTurn === username;

    document.getElementById('send').disabled = !isMyTurn;
    document.getElementById('guess-btn').disabled = !isMyTurn;

    const turnIndicator = document.getElementById('current-turn');
    turnIndicator.textContent = `Current Turn: ${gameMessageTurn}`;
};

const Asking = () => {
    EnableOptions();
    const username = localStorage.getItem('username');
    document.getElementById('send').textContent = 'ask';
    const turnIndicator = document.getElementById('current-turn');
    turnIndicator.textContent = `Current Turn: ${username}`;
};
const Answering = () => {
    EnableChat();
    document.getElementById('send').textContent = 'answer';
};

const OtherAsking = () => {
    DisableOptions();
    const turnIndicator = document.getElementById('current-turn');
    turnIndicator.textContent = `Current Turn: ${OtherPlayer()}`;
};
const OtherPlayer = () => {
    const game = JSON.parse(localStorage.getItem('game'));
    const username = localStorage.getItem('username');
    return game.players[0].username === username ? game.players[1].username : game.players[0].username;
}
const OtherAnswering = () => {
    DisableOptions();
};

const updateAnswer = () => {}
const updateMyTurn = () => {
    EnableOptions();
    const username = localStorage.getItem('username');
    document.getElementById('send').textContent = 'ask';
    const turnIndicator = document.getElementById('current-turn');
    turnIndicator.textContent = `Current Turn: ${username}`;
}

const DisableOptions = () => {
    DisableChat();
    DisableGuess();
}
const DisableChat = () => {document.getElementById('send').disabled = true;}
const DisableGuess = () => {document.getElementById('guess-btn').disabled = true;}
const EnableOptions = () => {
    EnableChat();
    EnableGuess();
}
const EnableChat = () => {document.getElementById('send').disabled = false;}
const EnableGuess = () => {document.getElementById('guess-btn').disabled = false;}


const updateOnChat = (msgUsername) => {

    console.log(`update my turn`);
    const username = localStorage.getItem('username');
    if (msgUsername !== username){
        document.getElementById('send').disabled = false;
        document.getElementById('guess-btn').disabled = false;

        const turnIndicator = document.getElementById('current-turn');
        turnIndicator.textContent = `Current Turn: ${username}`;
    }
};