import React, { useEffect, useRef } from "react";
import Codemirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/dracula.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/addon/edit/closetag';
import 'codemirror/addon/edit/closebrackets';
import ACTIONS from "../Actions";

const Editor = ({ socketRef, roomId, onCodeChange }) => {

    const textareaRef = useRef(null);
    const editorRef = useRef(null);

    // Effect 1: Initialize the CodeMirror editor once
    useEffect(() => {
        if (!textareaRef.current || editorRef.current) return;

        editorRef.current = Codemirror.fromTextArea(
            textareaRef.current,
            {
                mode: { name: 'javascript', json: true },
                theme: 'dracula',
                autoCloseTags: true,
                autoCloseBrackets: true,
                lineNumbers: true,
            }
        );

        // Listen for local user typing and broadcast it
        editorRef.current.on('change', (instance, changes) => {
            const { origin } = changes;
            const code = instance.getValue();
            onCodeChange(code);
            if (origin !== 'setValue' && socketRef.current) {
                socketRef.current.emit(ACTIONS.CODE_CHANGE, {
                    roomId,
                    code,
                });
            }
        });

        return () => {
            if (editorRef.current) {
                editorRef.current.toTextArea();
                editorRef.current = null;
            }
        };
    }, []);

    // Effect 2: Set up the incoming CODE_CHANGE listener as soon as socket is ready.
    // This runs whenever socketRef.current changes, ensuring the listener is registered
    // before the server sends the SYNC_CODE payload to the new joiner.
    useEffect(() => {
        if (!socketRef.current) return;

        const handleCodeChange = ({ code }) => {
            if (code !== null && editorRef.current) {
                const currentCode = editorRef.current.getValue();

                // Prevent unnecessary overwrite and cursor jumps
                if (currentCode === code) return;

                const cursor = editorRef.current.getCursor();
                editorRef.current.setValue(code);
                editorRef.current.setCursor(cursor);
            }
        };

        socketRef.current.on(ACTIONS.CODE_CHANGE, handleCodeChange);

        return () => {
            if (socketRef.current) {
                socketRef.current.off(ACTIONS.CODE_CHANGE, handleCodeChange);
            }
        };
    }, [socketRef.current]); // re-runs when socket becomes available

    return <textarea ref={textareaRef}></textarea>;
};

export default Editor;