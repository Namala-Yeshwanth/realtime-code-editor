import React, { useEffect, useRef } from "react";
import Codemirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/dracula.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/addon/edit/closetag';
import 'codemirror/addon/edit/closebrackets';

const Editor = () => {
    // 1. Use a Ref to store the editor instance
    const editorRef = useRef(null);

    useEffect(() => {
        async function init() {
            // 2. Check if the editor already exists to prevent double initialization
            if (!editorRef.current) {
                editorRef.current = Codemirror.fromTextArea(
                    document.getElementById('realtimeEditor'), 
                    {
                        mode: { name: 'javascript', json: true },
                        theme: 'dracula',
                        autoCloseTags: true,
                        autoCloseBrackets: true,
                        lineNumbers: true,
                    }
                );
            }
        }
        init();

        // 3. Optional: Cleanup function to remove the editor when component unmounts
        return () => {
            if (editorRef.current) {
                editorRef.current.toTextArea();
                editorRef.current = null;
            }
        };
    }, []);

    return <textarea id="realtimeEditor"></textarea>;
}

export default Editor;