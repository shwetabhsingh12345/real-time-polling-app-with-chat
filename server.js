const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let pollOptions = {};
let pollQuestion = '';
let messages = [];
let users = {};
let userVotes = {};
let userProfiles = {};  // Store user profiles
let pollTimer;
let pollTimeRemaining = 60;

app.use(express.static('public'));

const fetchRandomQuestion = async () => {
  try {
    const response = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple');
    const questionData = response.data.results[0];
    pollQuestion = questionData.question;
    pollOptions = {
      [questionData.correct_answer]: 0,
      ...Object.fromEntries(questionData.incorrect_answers.map(option => [option, 0]))
    };
    userVotes = {};
    io.emit('poll data', { pollQuestion, pollOptions });
  } catch (error) {
    console.error('Error fetching question:', error);
  }
};

const startPollTimer = () => {
  pollTimeRemaining = 60;
  pollTimer = setInterval(() => {
    pollTimeRemaining--;
    io.emit('timer', pollTimeRemaining);
    if (pollTimeRemaining <= 0) {
      clearInterval(pollTimer);
      fetchRandomQuestion();
      startPollTimer();
    }
  }, 1000);
};

io.on('connection', (socket) => {
  console.log('New user connected');

  // Handle user joining with username
  socket.on('join', (username) => {
    users[socket.id] = username;
    userProfiles[socket.id] = { username, notificationsEnabled: true };
    socket.emit('poll data', { pollQuestion, pollOptions });
    socket.emit('chat history', messages);
    socket.emit('timer', pollTimeRemaining);
    io.emit('user joined', username);  // Notify others when a user joins
  });

  // Handle voting
  socket.on('vote', (option) => {
    const currentVote = userVotes[socket.id];
    if (pollOptions[option] !== undefined) {
      if (currentVote) {
        pollOptions[currentVote]--;
      }
      if (currentVote !== option) {
        pollOptions[option]++;
        userVotes[socket.id] = option;
      } else {
        delete userVotes[socket.id];
      }
      io.emit('poll data', { pollQuestion, pollOptions });
    }
  });

  // Handle extending the poll timer
  socket.on('extend timer', () => {
    pollTimeRemaining += 30;
    io.emit('timer', pollTimeRemaining);
  });

  // Handle sending chat message
  socket.on('chat message', (msg) => {
    const message = { id: messages.length, username: users[socket.id], text: msg, userId: socket.id, edited: false };
    messages.push(message);
    io.emit('chat message', message);
    Object.values(userProfiles).forEach(profile => {
      if (profile.notificationsEnabled) {
        io.to(profile.socketId).emit('chat notification', `${message.username}: ${message.text}`);
      }
    });
  });

  // Handle editing message
  socket.on('edit message', (data) => {
    const { id, text, username } = data;
    if (messages[id] && messages[id].userId === socket.id) {
      messages[id].text = text;
      messages[id].username = username;
      messages[id].edited = true;
      io.emit('edit message', messages[id]);
    }
  });

  // Handle deleting message
  socket.on('delete message', (id) => {
    if (messages[id] && messages[id].userId === socket.id) {
      messages[id] = null;
      io.emit('delete message', id);
    }
  });

  // Handle typing indication
  socket.on('typing', () => {
    socket.broadcast.emit('typing', users[socket.id]);
  });

  socket.on('stop typing', () => {
    socket.broadcast.emit('stop typing', users[socket.id]);
  });

  // Handle toggling notifications
  socket.on('toggle notifications', () => {
    if (userProfiles[socket.id]) {
      userProfiles[socket.id].notificationsEnabled = !userProfiles[socket.id].notificationsEnabled;
      socket.emit('notification status', userProfiles[socket.id].notificationsEnabled);
    }
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected');
    delete users[socket.id];
    delete userProfiles[socket.id];
  });
});

// Fetch a random question when server starts
fetchRandomQuestion();
startPollTimer();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
