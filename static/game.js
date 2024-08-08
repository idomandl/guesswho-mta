let ws;

const connectWebSocket = (username) => {
    console.log(`Connecting WebSocket for ${username}`);
    ws = new WebSocket(`ws://localhost:3000`, username);

    ws.onopen = () => {
        console.log('WebSocket connection opened');
    };

    ws.onmessage = (event) => {
        console.log('WebSocket message received:', event.data);
        const message = JSON.parse(event.data);
        if (message.type === 'start-game') {
            console.log('Game starting:', message.game);
            showGame(message.game);
            displayBoard(message.game.board);
            displayWhoCard(message.game.whoCards);
            localStorage.setItem('game', JSON.stringify(message.game));
        } else if (message.type === 'chat-message' || message.type === 'answer') {
            console.log('Chat or Answer message received:', message);
            displayMessage(message);
            updateGameState(message.currentTurn, message.type);
        } else if (message.type === 'guess-result') {
            console.log('Guess result received:', message);
            displayMessage(message);
            updateGameState(message.username, 'answer');
        } else if (message.type === 'game-over') {
            console.log('Game over:', message.winner);
            alert(`Game over! Winner: ${message.winner}`);
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
    document.getElementById('game').style.display = 'block';
    console.log(`show game(game.currentTurn): ${game.currentTurn}`);
    document.getElementById('current-turn').textContent = `Current Turn: ${game.currentTurn}`;
    updateGameState(game.currentTurn, 'ask');
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
        } else {
            console.log('Waiting for another player to join the public match');
            alert('Waiting for another player to join the public match');
        }
    } catch (error) {
        console.error('Error starting public match:', error);
    }
};

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
        boardElement.appendChild(cardElement);
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

// Function to send a message or answer
const sendMessage = () => {
    const message = document.getElementById('message').value;
    const username = localStorage.getItem('username');
    const buttonType = document.getElementById('send').dataset.type;
    const messageType = buttonType === 'ask' ? 'chat-message' : 'answer';
    const chatMessage = { type: messageType, username, message };
    console.log(`Sending ${messageType}:`, chatMessage);

    ws.send(JSON.stringify(chatMessage));
    document.getElementById('message').value = '';
};

// Function to make a guess
const guess = () => {
    const cardName = document.getElementById('guess').value;
    const username = localStorage.getItem('username');
    const guessMessage = { type: 'guess', username, cardName };
    console.log('Making a guess:', guessMessage);

    ws.send(JSON.stringify(guessMessage));
    document.getElementById('guess').value = '';
};

// Function to display a chat or answer message
const displayMessage = (chatMessage) => {
    const chatElement = document.getElementById('chat');
    const messageElement = document.createElement('div');
    messageElement.textContent = `${chatMessage.username}: ${chatMessage.message}`;
    chatElement.appendChild(messageElement);
    chatElement.scrollTop = chatElement.scrollHeight; // Scroll to the bottom
};

// Function to update game state and UI based on the current turn and action type
const updateGameState = (currentTurn, actionType) => {
    const username = localStorage.getItem('username');
    const isMyTurn = currentTurn === username;
    const sendButton = document.getElementById('send');

    if (actionType === 'chat-message' || actionType === 'ask') {
        sendButton.textContent = 'Answer';
        sendButton.dataset.type = 'answer';
        document.getElementById('guess').disabled = true;
    } else if (actionType === 'answer' || actionType === 'guess-result') {
        sendButton.textContent = 'Ask';
        sendButton.dataset.type = 'ask';
        document.getElementById('guess').disabled = !isMyTurn;
    }

    sendButton.disabled = !isMyTurn;
    const turnIndicator = document.getElementById('current-turn');
    turnIndicator.textContent = `Current Turn: ${currentTurn}`;
};
