const apiUrl = 'http://localhost:3000';

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
