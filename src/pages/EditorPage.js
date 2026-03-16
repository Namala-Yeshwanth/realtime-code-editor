import React, { useEffect, useRef, useState } from 'react'
import Client from '../components/Client.js';
import Editor from '../components/editor.js';
import { initSocket } from '../socket.js';

import ACTIONS from '../Actions.js';
import toast from 'react-hot-toast';
import { useLocation, useNavigate, Navigate, useParams } from 'react-router-dom';


const EditorPage = ()=>{
    const socketRef = useRef(null);
    const location = useLocation();
    const {roomId} = useParams();
    
    const reactNavigator = useNavigate();  //to not get error i'm giving a diff name other than navigate
    
    // change of useState => will re-render but change of useRef will not re-render 
    const [clients, setClients] = useState([]);


    useEffect(()=>{
        const init = async () =>{
            // below code to connect client to server
            socketRef.current = await initSocket();
            socketRef.current.on('connect_error', (err)=> handleErrors(err));
            socketRef.current.on('connect_failed', (err)=> handleErrors(err));


            function handleErrors(e) {
                console.log('socket errors', e);
                toast.error('Socket connection failed, try again later.');
                reactNavigator('/');  //redirect to homepage
            }

            // here we are able to use await because in socket.js, we written async func, so it returns promise function
            // below code to send username to editorpage
            socketRef.current.emit(ACTIONS.JOIN, {
                roomId,
                username: location.state?.username,
            });

            // Listening for joined event
            socketRef.current.on(ACTIONS.JOINED, ({clients, username, socketId}) => {
                if(username!== location.state?.username){
                    // notify others except current user(me)
                    toast.success(`${username} Joined the room..`);
                    console.log(`${username} joined`); 
                }
                setClients(clients);
            });

        };
        init();
    },[]);  //if we didn't give [] then it will call for everything


    if(!location.state){
        return <Navigate to="/"/>
    }

    return (
        <div className='mainWrap'>
            <div className='aside'>
                <div className='asideInner'>
                    <div className='logo'>
                        <img className='logoImage' 
                            src='/code-sync.png' 
                            alt='logo'
                        />
                    </div>
                    <h3>Connected</h3>
                    <div className='clientsList'>
                        {
                            clients.map((client) =>(
                                <Client 
                                    key={client.socketId} 
                                    username={client.username} 
                                />
                        ))}
                    </div>
                </div>
                <button className='btn copyBtn'>Copy Room ID</button>
                <button className='btn leaveBtn'>Leave</button>
            </div>
            <div className='editorWrap'>
                <Editor />
            </div>
        </div>
    )
};

export default EditorPage;