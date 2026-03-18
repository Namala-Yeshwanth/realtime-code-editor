const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { setupWSConnection } = require('y-socket.io/dist/server');
const ACTIONS = require('./src/Actions');

const server = http.createServer(app);
const io = new Server(server);

// Serve the React build folder
app.use(express.static(path.join(__dirname, 'build')));

// For any route that is not a socket route, serve the React app
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

    // Hand off this socket to Yjs — it will handle all document sync,
    // conflict resolution, and cursor awareness automatically
    setupWSConnection(socket);

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

    // CODE_CHANGE and SYNC_CODE are no longer needed —
    // Yjs handles all content sync internally.
    // Keeping them commented out for reference.
    // socket.on(ACTIONS.CODE_CHANGE, ...);
    // socket.on(ACTIONS.SYNC_CODE, ...);

    // Explicit leave via button click — notify others immediately
    socket.on(ACTIONS.LEAVE, ({ roomId, username }) => {
        socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
            socketId: socket.id,
            username,
        });
        delete userSocketMap[socket.id];
        socket.leave(roomId);
    });

    // Handles tab close / network drop — natural disconnect
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