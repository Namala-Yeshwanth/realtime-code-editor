import React, { useEffect, useRef } from "react";
import Codemirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/dracula.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/addon/edit/closetag';
import 'codemirror/addon/edit/closebrackets';
import * as Y from 'yjs';
import { CodemirrorBinding } from 'y-codemirror';
import { SocketIOProvider } from 'y-socket.io';

// Each user gets a random bright color for their cursor
const COLORS = [
    '#F44336', '#E91E63', '#9C27B0', '#3F51B5',
    '#2196F3', '#00BCD4', '#4CAF50', '#FF9800',
    '#FF5722', '#607D8B',
];
const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

const Editor = ({ socketRef, roomId, onCodeChange, username }) => {
    const textareaRef = useRef(null);
    const editorRef = useRef(null);

    useEffect(() => {
        if (!textareaRef.current || editorRef.current) return;

        // 1. Create a Yjs document — one per room session
        const ydoc = new Y.Doc();

        // 2. Connect Yjs to the server via your existing Socket.IO connection.
        //    We pass the already-connected socket so Yjs reuses it — no second connection.
        const provider = new SocketIOProvider(
            process.env.REACT_APP_BACKEND_URL || window.location.origin,
            roomId,
            ydoc,
            {
                autoConnect: true,
                // Pass the existing socket so Yjs reuses it
                socket: socketRef.current,
            }
        );

        // 3. Set this user's awareness info (shown as cursor label)
        provider.awareness.setLocalStateField('user', {
            name: username,
            color: getRandomColor(),
        });

        // 4. The shared text that all users edit together
        const ytext = ydoc.getText('codemirror');

        // 5. Init CodeMirror
        editorRef.current = Codemirror.fromTextArea(textareaRef.current, {
            mode: { name: 'javascript', json: true },
            theme: 'dracula',
            autoCloseTags: true,
            autoCloseBrackets: true,
            lineNumbers: true,
        });

        // 6. Bind Yjs ↔ CodeMirror.
        //    This single binding handles ALL of:
        //    - syncing content between users (CRDT, no conflicts)
        //    - showing remote cursors with name labels
        //    - syncing state to new joiners automatically
        const binding = new CodemirrorBinding(
            ytext,
            editorRef.current,
            provider.awareness
        );

        // 7. Keep onCodeChange updated so EditorPage's codeRef stays in sync
        editorRef.current.on('change', (instance) => {
            onCodeChange(instance.getValue());
        });

        // Cleanup on unmount
        return () => {
            binding.destroy();
            provider.destroy();
            ydoc.destroy();
            if (editorRef.current) {
                editorRef.current.toTextArea();
                editorRef.current = null;
            }
        };
    }, []);

    return <textarea ref={textareaRef}></textarea>;
};

export default Editor;