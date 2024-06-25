const socket = io();
let userId;
let chart;

document.getElementById('join-btn').addEventListener('click', () => {
  const username = document.getElementById('username').value;
  if (username) {
    socket.emit('join', username);
    document.getElementById('login').style.display = 'none';
    document.getElementById('main').classList.remove('hidden');
  } else {
    alert('Username cannot be empty');
  }
});

function vote(option) {
  socket.emit('vote', option);
}

document.getElementById('extend-timer-btn').addEventListener('click', () => {
  socket.emit('extend timer');
});

document.getElementById('send-btn').addEventListener('click', () => {
  const message = document.getElementById('chat-input').value;
  if (message) {
    socket.emit('chat message', message);
    document.getElementById('chat-input').value = '';
  }
});

document.getElementById('chat-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('send-btn').click();
  }
});

document.getElementById('toggle-notifications').addEventListener('click', () => {
  socket.emit('toggle notifications');
});

socket.on('notification status', (status) => {
  alert(`Notifications are now ${status ? 'enabled' : 'disabled'}`);
});

socket.on('poll data', ({ pollQuestion, pollOptions }) => {
  document.getElementById('poll-question').innerHTML = pollQuestion;
  const optionsContainer = document.getElementById('options');
  optionsContainer.innerHTML = '';
  Object.keys(pollOptions).forEach(option => {
    const optionElement = document.createElement('button');
    optionElement.textContent = `${option} (${pollOptions[option]})`;
    optionElement.className = 'btn bg-blue-500 text-white w-full mb-2 px-4 py-2 rounded hover:bg-blue-600';
    optionElement.onclick = () => vote(option);
    optionsContainer.appendChild(optionElement);
  });

  const totalVotes = Object.values(pollOptions).reduce((acc, val) => acc + val, 0);
  const percentages = Object.keys(pollOptions).map(option => (pollOptions[option] / totalVotes) * 100);

  const chartData = {
    labels: Object.keys(pollOptions),
    datasets: [{
      label: 'Votes',
      data: percentages,
      backgroundColor: ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56'],
      borderWidth: 1
    }]
  };

  if (chart) {
    chart.data = chartData;
    chart.update();
  } else {
    const ctx = document.getElementById('poll-chart').getContext('2d');
    chart = new Chart(ctx, {
      type: 'bar',
      data: chartData,
      options: {
        scales: {
          y: {
            beginAtZero: true,
            display: false
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }
});

socket.on('timer', (time) => {
  document.getElementById('timer').textContent = `${time}s`;
});

socket.on('chat history', (msgs) => {
  const messages = document.getElementById('messages');
  messages.innerHTML = '';
  msgs.forEach(msg => appendMessage(msg));
});

socket.on('chat message', (msg) => {
  appendMessage(msg);
});

socket.on('edit message', (msg) => {
  const item = document.getElementById(`msg-${msg.id}`);
  if (item) {
    const messageText = item.querySelector('.message-text');
    messageText.textContent = `${msg.username}: ${msg.text} (edited)`;
  }
});

socket.on('delete message', (id) => {
  const item = document.getElementById(`msg-${id}`);
  if (item) {
    item.remove();
  }
});

socket.on('typing', (username) => {
  const indicator = document.getElementById('typing-indicator');
  indicator.style.display = 'block';
  indicator.textContent = `${username} is typing...`;
});

socket.on('stop typing', () => {
  const indicator = document.getElementById('typing-indicator');
  indicator.style.display = 'none';
});

let typingTimer;

document.getElementById('chat-input').addEventListener('input', () => {
  clearTimeout(typingTimer);
  socket.emit('typing');
  typingTimer = setTimeout(() => {
    socket.emit('stop typing');
  }, 1000);
});

function appendMessage(msg) {
  const item = document.createElement('div');
  item.id = `msg-${msg.id}`;
  item.classList.add('message', 'p-2', 'mb-2', 'rounded', 'border', 'relative');

  const messageText = document.createElement('span');
  messageText.classList.add('message-text');
  messageText.textContent = `${msg.username}: ${msg.text}`;
  if (msg.edited) {
    messageText.textContent += ' (edited)';
  }
  item.appendChild(messageText);

  if (msg.userId === socket.id) {
    const actionsContainer = document.createElement('div');
    actionsContainer.classList.add('message-actions', 'absolute', 'top-2', 'right-2', 'flex', 'gap-2');

    const editButton = document.createElement('button');
    editButton.className = 'material-icons text-blue-500';
    editButton.textContent = 'edit';
    editButton.addEventListener('click', () => {
      messageText.contentEditable = true;
      messageText.focus();
      editButton.style.display = 'none';
      const saveButton = document.createElement('button');
      saveButton.className = 'material-icons text-green-500';
      saveButton.textContent = 'save';
      saveButton.addEventListener('click', () => {
        messageText.contentEditable = false;
        saveButton.remove();
        editButton.style.display = 'block';
        socket.emit('edit message', { id: msg.id, text: messageText.textContent.replace(' (edited)', ''), username: msg.username });
      });
      actionsContainer.appendChild(saveButton);
    });
    actionsContainer.appendChild(editButton);

    const deleteButton = document.createElement('button');
    deleteButton.className = 'material-icons text-red-500';
    deleteButton.textContent = 'delete';
    deleteButton.addEventListener('click', () => {
      socket.emit('delete message', msg.id);
    });
    actionsContainer.appendChild(deleteButton);

    item.appendChild(actionsContainer);
  }

  document.getElementById('messages').appendChild(item);
}
