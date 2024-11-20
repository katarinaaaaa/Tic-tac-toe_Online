from fastapi import FastAPI, WebSocket
from starlette.websockets import WebSocketDisconnect
from typing import Dict
import json
import random
import string
from db import DB

class Server():
    wins = [ [0, 1, 2], [3, 4, 5], [6, 7, 8], # rows
             [0, 3, 6], [1, 4, 7], [2, 5, 8], # columns
             [0, 4, 8], [2, 4, 6] ]           # diagonals
    
    def __init__(self):
        self.client_id_counter = 0
        self.connections: Dict[int, WebSocket] = {} # client_id: socket
        self.opponents: Dict[int, int] = {} # client_id: opponent_client_id
        self.names: Dict[int, str] = {} # client_id: client_name
        self.rooms: Dict[int, str] = {} # client_id: room_name
        self.id_waiting_for_random = None
        self.db = DB()
       
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        client_id = self.create_client_id()
        self.connections[client_id] = websocket
        return client_id
    
    async def disconnect(self, client_id):
        del self.connections[client_id]
        if client_id == self.id_waiting_for_random:
            self.id_waiting_for_random = None
            return
        if client_id in self.rooms:
            del self.rooms[client_id]
        if client_id in self.opponents:
            opponent_id = self.opponents[client_id]
            if opponent_id in self.rooms:
                del self.rooms[opponent_id]
            await self.send(opponent_id, "left", "")
            del self.opponents[client_id]
            del self.opponents[opponent_id]
        
    def create_client_id(self):
        self.client_id_counter += 1
        return self.client_id_counter

    async def send(self, client_id, method, info):
        client = self.connections[client_id]
        await client.send_json({ 'method': method, 'info': info })


    async def match(self, client_id, opponent_id, room_name):
        self.opponents[client_id] = opponent_id
        self.opponents[opponent_id] = client_id
        self.rooms[client_id] = room_name
        await self.send(opponent_id, "opponent_name", self.names[client_id])
        await self.send(client_id, "opponent_name", self.names[opponent_id])
        await self.send(opponent_id, "start", "X") # first client plays with X
        await self.send(client_id, "start", "O") # second client plays with O

    async def match_random_clients(self, client_id):
        if self.id_waiting_for_random is None:
            self.id_waiting_for_random = client_id
            await self.send(client_id, "enter_room", "")
        else:
            while True:
                room_name = ''.join(random.choice(string.ascii_letters) for i in range(5))
                if room_name not in self.rooms.values(): 
                    break
            await self.send(client_id, "enter_room", "")
            await self.match(client_id, self.id_waiting_for_random, room_name) # create random room name
            self.rooms[self.id_waiting_for_random] = room_name
            self.id_waiting_for_random = None


    def is_draw(self, game_field):
        return all([cell == "X" or cell == "O" for cell in game_field])

    def is_win(self, game_field):
        return any([(game_field[comb[0]] == "X" or game_field[comb[0]] == "O") and 
                (game_field[comb[0]] == game_field[comb[1]] == game_field[comb[2]]) 
                for comb in self.wins])
        
    async def update_game_field(self, game_field, client_id):     
        if self.is_win(game_field):
            method = "win"
        elif self.is_draw(game_field):
            method = "draw"
        else:
            method = "update"
        await self.send(client_id, method, game_field)
        await self.send(self.opponents[client_id], method, game_field)


    async def process_message(self, data, client_id):
        method = data['method']
        info = data['info']

        if method == 'name':
            self.names[client_id] = info

        elif method == 'match_random':
            await self.match_random_clients(client_id)
        
        elif method == "get_leaderboard":
            leaderboard = self.db.get_leaderboard()
            await self.send(client_id, "leaderboard", leaderboard)

        elif method == "game_stats":
            self.db.add_game_stats(info['user'], info['opponent'], info['user_wins'], 
                                   info['opponent_wins'], info['draws'])

        elif method == 'create_room':
            if info in self.rooms.values():
                await self.send(client_id, "room_error_exists", "")
            else:
                self.rooms[client_id] = info
                await self.send(client_id, "enter_room", "")

        elif method == 'join_room':
            if info not in self.rooms.values():
                await self.send(client_id, "room_error_dont_exist", "")
            else:
                opponent_id = [key for (key, value) in self.rooms.items() if value == info]
                if len(opponent_id) > 1:
                    await self.send(client_id, "room_error_full", "")
                else:
                    opponent_id = opponent_id[0]
                    await self.send(client_id, "enter_room", "")
                    await self.match(client_id, opponent_id, info)

        elif method == "move":
            await self.update_game_field(data['info'], client_id)


app = FastAPI()
server = Server()

@app.get("/")
def greeting():
    return {"message": "Hello World! This is the server part for the online tic-tac-toe game"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    client_id = await server.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            data = json.loads(data)
            await server.process_message(data, client_id)
    except WebSocketDisconnect:
        await server.disconnect(client_id)
    except:
        pass