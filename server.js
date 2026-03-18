const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const ACTIONS = require('./src/Actions');
const path = require('path');

const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('build'));
// as we launch from backend and in backend we don't have editor/..
// so added this so that when we refresh it doesn't give error 
app.use((req, res, next)=> {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const userSocketMap = {};
function getAllConnectedClients(roomId) {
    // Map
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
        (socketId)=>{
            return {
                socketId,
                username: userSocketMap[socketId],
            };
        }
    );
}

io.on('connection', (socket) =>{
    console.log('socket connected', socket.id);

    socket.on(ACTIONS.JOIN, ({roomId, username}) => {
        userSocketMap[socket.id] = username;
        socket.join(roomId);
        const clients = getAllConnectedClients(roomId);
        clients.forEach(({socketId})=>{
            io.to(socketId).emit(ACTIONS.JOINED,{
                clients,
                username,
                socketId: socket.id,
            });
        });
    });

    socket.on(ACTIONS.CODE_CHANGE, ({roomId, code})=> {
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, {code});
    });

    socket.on(ACTIONS.SYNC_CODE, ({socketId, code})=> {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, {code});
    });

    // Explicit leave via button click — notify others immediately
    socket.on(ACTIONS.LEAVE, ({ roomId, username }) => {
        socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
            socketId: socket.id,
            username,
        });
        delete userSocketMap[socket.id];
        socket.leave(roomId);
    });

    socket.on('disconnecting', ()=>{
        const rooms = [...socket.rooms];
        rooms.forEach((roomId)=>{
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],  // username still exists here ✓
            });
        });
        delete userSocketMap[socket.id];  // delete AFTER emitting, not before ✓
        socket.leave();
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, ()=> console.log(`Listening on port ${PORT}`));