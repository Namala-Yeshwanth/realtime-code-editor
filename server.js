const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const ACTIONS = require('./src/Actions');

const server = http.createServer(app);
const io = new Server(server);

// Serve React build
app.use(express.static(path.join(__dirname, 'build')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const userSocketMap = {};

function getAllConnectedClients(roomId) {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
        (socketId) => ({
            socketId,
            username: userSocketMap[socketId],
        })
    );
}

io.on('connection', (socket) => {
    console.log('socket connected', socket.id);

    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
        userSocketMap[socket.id] = username;
        socket.join(roomId);
        const clients = getAllConnectedClients(roomId);
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id,
            });
        });
    });

    // Broadcast code change to everyone else in the room,
    // and include socketId so receiver can render the remote cursor
    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code, cursor, username, color }) => {
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, {
            code,
            cursor,
            username,
            color,
            socketId: socket.id,
        });
    });

    // Sync full code to a newly joined client
    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    // Broadcast cursor movement (no code change, just cursor)
    socket.on(ACTIONS.CURSOR_MOVE, ({ roomId, cursor, username, color }) => {
        socket.in(roomId).emit(ACTIONS.CURSOR_MOVE, {
            cursor,
            username,
            color,
            socketId: socket.id,
        });
    });

    // Explicit leave via button
    socket.on(ACTIONS.LEAVE, ({ roomId, username }) => {
        socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
            socketId: socket.id,
            username,
        });
        delete userSocketMap[socket.id];
        socket.leave(roomId);
    });

    // Tab close / network drop
    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });
        delete userSocketMap[socket.id];
        socket.leave();
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));