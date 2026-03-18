import React, { useEffect, useRef } from "react";
import Codemirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/dracula.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/addon/edit/closetag';
import 'codemirror/addon/edit/closebrackets';
import ACTIONS from "../Actions";

const COLORS = [
    '#F44336', '#E91E63', '#9C27B0', '#3F51B5',
    '#2196F3', '#00BCD4', '#4CAF50', '#FF9800',
];
const getColor = (name) => COLORS[
    [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % COLORS.length
];

const Editor = ({ socketRef, roomId, onCodeChange, username }) => {
    const textareaRef = useRef(null);
    const editorRef = useRef(null);
    // Track remote cursors: socketId -> { cursor, color, label element }
    const cursorsRef = useRef({});

    useEffect(() => {
        if (!textareaRef.current || editorRef.current) return;

        editorRef.current = Codemirror.fromTextArea(textareaRef.current, {
            mode: { name: 'javascript', json: true },
            theme: 'dracula',
            autoCloseTags: true,
            autoCloseBrackets: true,
            lineNumbers: true,
        });

        return () => {
            if (editorRef.current) {
                editorRef.current.toTextArea();
                editorRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!socketRef.current) return;

        const userColor = getColor(username || 'user');

        // ---- Outgoing: broadcast code + my cursor position ----
        const handleChange = (instance, changes) => {
            const { origin } = changes;
            const code = instance.getValue();
            onCodeChange(code);
            if (origin !== 'setValue') {
                socketRef.current.emit(ACTIONS.CODE_CHANGE, {
                    roomId,
                    code,
                    cursor: instance.getCursor(),
                    username,
                    color: userColor,
                });
            }
        };
        editorRef.current.on('change', handleChange);

        // Broadcast cursor movement even without typing
        const handleCursorActivity = (instance) => {
            if (!socketRef.current) return;
            socketRef.current.emit(ACTIONS.CURSOR_MOVE, {
                roomId,
                cursor: instance.getCursor(),
                username,
                color: userColor,
            });
        };
        editorRef.current.on('cursorActivity', handleCursorActivity);

        // ---- Incoming: receive code changes ----
        const handleCodeChange = ({ code, cursor, username: remoteUser, color, socketId }) => {
            if (!editorRef.current || code === null) return;

            const currentCode = editorRef.current.getValue();
            if (currentCode === code) return;

            // Save my own cursor before overwriting
            const myCursor = editorRef.current.getCursor();
            editorRef.current.setValue(code);
            editorRef.current.setCursor(myCursor);

            // Show remote user's cursor
            if (cursor && socketId) {
                showRemoteCursor(socketId, cursor, remoteUser, color);
            }
        };

        // ---- Incoming: receive cursor movements ----
        const handleCursorMove = ({ cursor, username: remoteUser, color, socketId }) => {
            if (!editorRef.current || !socketId) return;
            showRemoteCursor(socketId, cursor, remoteUser, color);
        };

        // ---- Incoming: remove cursor when user leaves ----
        const handleDisconnected = ({ socketId }) => {
            removeRemoteCursor(socketId);
        };

        socketRef.current.on(ACTIONS.CODE_CHANGE, handleCodeChange);
        socketRef.current.on(ACTIONS.CURSOR_MOVE, handleCursorMove);
        socketRef.current.on(ACTIONS.DISCONNECTED, handleDisconnected);

        return () => {
            if (editorRef.current) {
                editorRef.current.off('change', handleChange);
                editorRef.current.off('cursorActivity', handleCursorActivity);
            }
            if (socketRef.current) {
                socketRef.current.off(ACTIONS.CODE_CHANGE, handleCodeChange);
                socketRef.current.off(ACTIONS.CURSOR_MOVE, handleCursorMove);
                socketRef.current.off(ACTIONS.DISCONNECTED, handleDisconnected);
            }
        };
    }, [socketRef.current]);

    // ---- Draw a remote cursor bookmark in CodeMirror ----
    function showRemoteCursor(socketId, cursor, remoteUser, color) {
        const editor = editorRef.current;
        if (!editor) return;

        // Remove old cursor for this user
        removeRemoteCursor(socketId);

        // Create label element
        const label = document.createElement('span');
        label.className = 'remote-cursor-label';
        label.textContent = remoteUser;
        label.style.cssText = `
            background: ${color};
            color: #fff;
            font-size: 10px;
            font-weight: bold;
            padding: 1px 4px;
            border-radius: 3px;
            position: absolute;
            top: -18px;
            white-space: nowrap;
            pointer-events: none;
            z-index: 99;
        `;

        // Create caret element
        const caret = document.createElement('span');
        caret.className = 'remote-cursor-caret';
        caret.style.cssText = `
            border-left: 2px solid ${color};
            height: 18px;
            display: inline-block;
            position: relative;
        `;
        caret.appendChild(label);

        // Place bookmark at remote cursor position
        const bookmark = editor.setBookmark(
            { line: cursor.line, ch: cursor.ch },
            { widget: caret, insertLeft: true }
        );

        cursorsRef.current[socketId] = bookmark;
    }

    function removeRemoteCursor(socketId) {
        if (cursorsRef.current[socketId]) {
            cursorsRef.current[socketId].clear();
            delete cursorsRef.current[socketId];
        }
    }

    return <textarea ref={textareaRef}></textarea>;
};

export default Editor;