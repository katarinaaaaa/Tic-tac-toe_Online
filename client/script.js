const cellElements = document.querySelectorAll('.cell');
const textElement = document.querySelector('.text');

const mainTitle = document.querySelector('.title');
const loginName = document.querySelector('.login_name');
const loginRoom = document.querySelector('.login_room');
const leaderboard = document.querySelector('.leaderboard');
const game = document.querySelector('.game');

const buttonRandom = document.querySelector('.button_random');
const buttonRooms = document.querySelector('.button_rooms');
const buttonLeaderboard = document.querySelector('.button_leaderboard');
const buttonCreate = document.querySelector('.button_create');
const buttonJoin = document.querySelector('.button_join');

const inputName = document.querySelector('.username_input');
const inputRoom = document.querySelector('.room_input');
const inputItems = document.querySelectorAll('input');

const infoUserName = document.querySelector('.info_user_name');
const infoUserPlays = document.querySelector('.info_user_plays');
const infoOpponentName = document.querySelector('.info_opponent_name');
const infoOpponentPlays = document.querySelector('.info_opponent_plays');
const userWins = document.querySelector('.user_wins');
const opponentWins = document.querySelector('.opponent_wins');
const draws = document.querySelector('.draws');


let gameField = ["", "", "", "", "", "", "", "", ""];
let isGameActive = false;
let symbol = null;
let turn = null;

let username = null;
let opponentName = null;
let userWinsCount = 0;
let opponentWinsCount = 0;
let drawsCount = 0;


let ws = new WebSocket("backend-tic-tac-toe.up.railway.app/ws");

ws.onmessage = message => {
  const response = JSON.parse(message.data);

  if (response.method === "enter_room") {
    infoUserName.innerHTML = `you: ${username}`;
    [mainTitle, loginName, loginRoom].forEach((elem) => { elem.classList.add("off"); });
    game.classList.remove("off");
  }

  if (response.method === "opponent_name") {
    opponentName = response.info;
  }

  if (response.method === "start") {
    symbol = response.info;
    turn = "X";

    infoUserPlays.innerHTML = `now play with: ${symbol}`;
    infoOpponentName.innerHTML = `opponent: ${opponentName}`;
    infoOpponentPlays.innerHTML = `now plays with: ${symbol === "X" ? "O" : "X"}`;

    userWins.innerHTML = `${username} wins: 0`;
    opponentWins.innerHTML = `${opponentName} wins: 0`;
    draws.innerHTML = `draws: 0`;

    isGameActive = symbol === turn;
    updateText();
  }

  if (response.method === "update") {
    gameField = response.info;
    turn = turn === "X" ? "O" : "X";
    isGameActive = symbol === turn;
    updateField();
    updateText();
  }

  if (response.method === "win" || response.method === "draw") {
    gameField = response.info;
    updateField();
    isGameActive = false;
    if (response.method === "win") {
      textElement.textContent = `${turn} won`;
      if (turn === symbol) {
        userWinsCount = userWinsCount + 1;
      }
      else {
        opponentWinsCount = opponentWinsCount + 1;
      }
    }
    else {
      textElement.textContent = "draw";
      drawsCount = drawsCount + 1;
    }
    document.body.style.cursor = 'wait';
    cellElements.forEach((cell) => { cell.classList.add("reset"); });
    setTimeout(() => { resetGame(); }, 2000);
  }

  if (response.method === "left") {
    isGameActive = false;
    textElement.textContent = "opponent left";
    if (!(userWinsCount == userWinsCount == userWinsCount == 0)) {
      ws.send(JSON.stringify({ "method": "game_stats", "info": {
        "user": username, 'opponent': opponentName, "user_wins": userWinsCount,
        "opponent_wins": opponentWinsCount, "draws": drawsCount
      } }));
    }
  }

  if (response.method === "room_error_exists" || response.method === "room_error_dont_exist" ||
      response.method === "room_error_full") {

    if (!inputRoom.classList.contains("invalid_input")) {
      inputRoom.classList.add("invalid_input");
    }
    inputRoom.value = "";

    if (response.method === "room_error_exists") {
       inputRoom.placeholder = "Room already exists";
    }
    else if (response.method === "room_error_dont_exist") {
      inputRoom.placeholder = "Room don't exist";   
    }
    else {
      inputRoom.placeholder = "Room is already full";   
    }
  }

  if (response.method === "leaderboard") {
    if (response.info.length == 0) {
      document.querySelector('.leaderboard_no_info').classList.remove("off");
    }
    else {
      table = "<tr><th>First player</th><th>Second player</th><th>First player wins</th><th>Second player wins</th><th>Draws</th></tr>";
      for (i in response.info) {
        row = response.info[i];
        table += "<tr>"
        for (const [key, value] of Object.entries(row)) {
          if (key !== "id") { 
            table += "<td>" + value + "</td>";
          }
        }
        table += "</tr>"
      }
      document.querySelector('.leaderboard_table').innerHTML = table;
    }
    document.body.style.cursor = 'default';
  }
};

function resetGame() {
  gameField = ["", "", "", "", "", "", "", "", ""];
  cellElements.forEach((cell) => { cell.classList.remove("X", "O"); });
  turn = "X";
  symbol = symbol === "X" ? "O" : "X";
  isGameActive = symbol === turn;
  updateText();

  cellElements.forEach((cell) => { cell.classList.remove("reset"); });
  document.body.style.cursor = 'default';

  infoUserPlays.innerHTML = `now play with: ${symbol}`;
  infoOpponentPlays.innerHTML = `now plays with: ${symbol === "X" ? "O" : "X"}`;
  userWins.innerHTML = `${username} wins: ${userWinsCount}`;
  opponentWins.innerHTML = `${opponentName} wins: ${opponentWinsCount}`;
  draws.innerHTML = `draws: ${drawsCount}`;
}

cellElements.forEach((cell, index) => cell.addEventListener('click', (event) => {
    move(event.target, index);
}));

function move(cell, index) {
  if (!isGameActive || gameField[index] !== "") {
    return;
  }
  isGameActive = false;
  cell.classList.add(symbol);
  gameField[index] = symbol;
  ws.send(JSON.stringify({ "method": "move", "info": gameField }));
}

function updateField() {
  cellElements.forEach((cell, index) => {
    cell.classList.remove("X", "O");
    gameField[index] !== "" && cell.classList.add(gameField[index]);
  });
}

function updateText() {
  if (symbol === turn) {
    textElement.textContent = "your turn";
  } else {
    textElement.textContent = `waiting ${turn} move...`;
  }
}

buttonRandom.addEventListener('click', (event) => {
  if (!check_input_emptiness(inputName)) {
    inputName.placeholder = "Username can't be empty";
  }
  else {
    username = inputName.value;
    ws.send(JSON.stringify({ "method": "name", "info": username }));
    [mainTitle, loginName].forEach((elem) => { elem.classList.add("off"); });
    game.classList.remove("off");
    ws.send(JSON.stringify({ "method": "match_random", "info": "" }));
  }
});

buttonRooms.addEventListener('click', (event) => {
  if (!check_input_emptiness(inputName)) {
    inputName.placeholder = "Username can't be empty";
  }
  else {
    username = inputName.value;
    ws.send(JSON.stringify({ "method": "name", "info": username }));
    [buttonRandom, buttonRooms, buttonLeaderboard].forEach((elem) => { elem.classList.add("off"); });
    inputName.readOnly = true;
    loginRoom.classList.remove("off");
  }
});

buttonLeaderboard.addEventListener('click', (event) => {
  ws.send(JSON.stringify({ "method": "get_leaderboard", "info": "" }));
  [mainTitle, loginName].forEach((elem) => { elem.classList.add("off"); });
  leaderboard.classList.remove("off");
  document.body.style.cursor = 'wait';
});

buttonCreate.addEventListener('click', (event) => {
  if (!check_input_emptiness(inputRoom)) {
    inputRoom.placeholder = "Room name can't be empty";
  }
  else {
    ws.send(JSON.stringify({ "method": "create_room", "info": inputRoom.value }));
  }
});

buttonJoin.addEventListener('click', (event) => {
  if (!check_input_emptiness(inputRoom)) {
    inputRoom.placeholder = "Room name can't be empty";
  }
  else {
    ws.send(JSON.stringify({ "method": "join_room", "info": inputRoom.value }));
  }
});

function check_input_emptiness(inputItem) {
  wasInvalid = inputItem.classList.contains("invalid_input");
  if (inputItem.value !== "") {
    if (wasInvalid) {
      inputItem.classList.remove("invalid_input");
    }
    return true
  }
  else {
    if (!wasInvalid) {
      inputItem.classList.add("invalid_input");
    }
    return false
  }
}

inputItems.forEach((inputItem) => inputItem.addEventListener('blur', () => { 
  if (inputItem.value !== "" && inputItem.classList.contains("invalid_input")) {
    inputItem.classList.remove("invalid_input");
  }
}));