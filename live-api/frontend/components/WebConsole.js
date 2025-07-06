import { useState, useRef, useEffect } from "react";
import TextChat from "components/TextChat";
import ToggleSwitch from "components/ToggleSwitch";
import DropdownMenu from "components/DropdownMenu";
import { GeminiLiveAPI } from "lib/gemini-live-api";
import {
  LiveAudioOutputManager, 
  LiveAudioInputManager, 
  LiveVideoManager,
} from "lib/live-media-manager";

export default function WebConsole() {

  const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL;
  const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID;
  const MODEL = "gemini-2.0-flash-live-preview-04-09";
  const API_HOST = "us-central1-aiplatform.googleapis.com"; 

  const [newModelMessage, setNewModelMessage] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [responseModality, setResponseModality] = useState("Text");
  const [googleSearch, setGoogleSearch] = useState("Off");
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [audioInput, setAudioInput] = useState(false);
  const [videoInput, setVideoInput] = useState(false);
  const [outputLanguage, setOutputLanguage] = useState("English");

  const _liveVideoManager = useRef();
  const _liveAudioOutputManager = useRef();
  const _liveAudioInputManager = useRef();

  const liveVideoManager = _liveVideoManager.current;
  const liveAudioOutputManager = _liveAudioOutputManager.current;
  const liveAudioInputManager = _liveAudioInputManager.current;

  const sleep = (time) => new Promise((r) => setTimeout(r, time));

  useEffect(() => {
    const videoElement = document.getElementById("video");
    const canvasElement = document.getElementById("canvas");
    _liveVideoManager.current = new LiveVideoManager(videoElement, canvasElement);
    _liveAudioInputManager.current = new LiveAudioInputManager();
    _liveAudioOutputManager.current = new LiveAudioOutputManager();
  }, []); 

  useEffect(() => {
    if (audioInput == true) {
          startAudioInput();
      if (connectionStatus == "connected") {
          startAudioStream();
      }
    } else {
      stopAudioStream();
      stopAudioInput();
    }
  }, [audioInput]);

  useEffect(() => {
    if (videoInput == true) {
        startVideoInput();
      if (connectionStatus == "connected") {
          startVideoStream();
      }
    } else {
        stopVideoStream();
        stopVideoInput();
    }
  }, [videoInput]);

  const isNotDisconnected = () => {
    return (connectionStatus !== "disconnected");
  };

  const _geminiLiveApi = useRef(
    new GeminiLiveAPI(PROXY_URL, PROJECT_ID, MODEL, API_HOST)
  );
  const geminiLiveApi = _geminiLiveApi.current;

  geminiLiveApi.onErrorMessage = (message) => {
    console.log(message);
  };

  const startAudioInput = async () => {
    if (!liveAudioInputManager) return;
    await liveAudioInputManager.connectMicrophone();
  };

  const stopAudioInput = async () => {
    if (!liveAudioInputManager) return;
    await liveAudioInputManager.disconnectMicrophone();
  };

  const startAudioStream = () => {
    if (!geminiLiveApi.isConnected) return;
    liveAudioInputManager.onNewAudioRecordingChunk = (audioData) => {
      console.log("send audio data");
      geminiLiveApi.sendAudioMessage(audioData);
    };
  }

  const stopAudioStream = () => {
    if (!liveAudioInputManager) return;
    liveAudioInputManager.onNewAudioRecordingChunk = () => {};
  }

  const startVideoInput = async () => {
    if (!liveVideoManager) return;
    await liveVideoManager.startWebcam();
  };

  const stopVideoInput = async () => {
    if (!liveVideoManager) return;
    await liveVideoManager.stopWebcam();
  };

  const startVideoStream = () => {
    if (!geminiLiveApi.isConnected) return;
    liveVideoManager.onNewFrame = (b64Image) => {
      console.log("send a video frame");
      geminiLiveApi.sendImageMessage(b64Image);
    };
  };

  const stopVideoStream = () => {
    if (!liveVideoManager) return;
    liveVideoManager.onNewFrame = () => {};
  };

  const connect = async () => {
    setButtonDisabled(true);
    // reset audio, video stream
    await sleep(200);
    stopAudioStream();
    await stopAudioInput();
    stopVideoStream();
    await stopVideoInput();
    await sleep(200);

    geminiLiveApi.setProjectId(PROJECT_ID);
    geminiLiveApi.responseModalities = [responseModality.toUpperCase()];
    const systemInstruction = "Output in " + outputLanguage + " unless user specifies it.";
    geminiLiveApi.systemInstructions = systemInstruction;
    const useGoogleSearch = (googleSearch == "On") ? true : false;
    geminiLiveApi.setGoogleSearch(useGoogleSearch);

    let connectionTimeoutId;

    geminiLiveApi.onConnectionStarted = async () => {
      clearTimeout(connectionTimeoutId);
      if (audioInput == true) {
        await startAudioInput();
        startAudioStream();
      }
      if (videoInput == true) {
        await startVideoInput();
        startVideoStream();
      }
      setConnectionStatus("connected");
      setButtonDisabled(false);
    };

    geminiLiveApi.connect(""); // Access token is not required.
    connectionTimeoutId = setTimeout(() => {
      console.log("Connection timeout");
      disconnect();
    }, 10000); // Timeout in 10secs.
  };

  const disconnect = async () => {
    setButtonDisabled(true);
    setAudioInput(false);
    setVideoInput(false);
    await sleep(200);
    await geminiLiveApi.disconnect();
    await sleep(800);
    setButtonDisabled(false);
    setConnectionStatus("disconnected");
  };

  geminiLiveApi.onReceiveResponse = (messageResponse) => {
    for (let i = 0; i < messageResponse.type.length; i++) {
      if (messageResponse.type[i] == "AUDIO") {
        liveAudioOutputManager.playAudioChunk(messageResponse.data[i]);
      }
      if (messageResponse.type[i] == "TEXT") {
        const message = messageResponse.data[i];
        console.log("Gemini said: ", message);
        setNewModelMessage(message); // Relay the message to child components.
      }
    }
  };

  const sendTextMessage = (message) => {
    console.log("Sending text to live API: ", message)
    geminiLiveApi.sendTextMessage(message);
  };

  let connectButton;
  if (buttonDisabled) {
    connectButton = (
      <button className="bg-gray-400
                         text-white font-bold py-2 px-4 rounded">
	    {(connectionStatus == "connected") ? "Disconnect" : "Connect"}</button>
    );
  } else if (connectionStatus == "connected") {
    connectButton = (
      <button className="bg-red-500 hover:bg-red-600
                         text-white font-bold py-2 px-4 rounded"
              onClick={disconnect}>Disconnect</button>
    );
  } else {
    connectButton = (
      <button className="bg-green-500 hover:bg-green-600
                         text-white font-bold py-2 px-4 rounded"
              onClick={connect}>Connect</button>
    );
  }

  let micButton;
  if (buttonDisabled) {
    micButton = (
      <button className="bg-gray-400
                         text-white font-bold py-2 px-4 rounded">
	    {(audioInput == false) ? "Mic on" : "Mic off"}</button>
    );
  } else if (audioInput == false) {
    micButton = (
      <button className="bg-green-500 hover:bg-green-600
                         text-white font-bold py-2 px-4 rounded"
              onClick={() => setAudioInput(true)}>Mic on</button>
    );
  } else {
    micButton = (
      <button className="bg-red-500 hover:bg-red-600
                         text-white font-bold py-2 px-4 rounded"
              onClick={() => setAudioInput(false)}>Mic off</button>
    );
  }

  let cameraButton;
  if (buttonDisabled) {
    cameraButton = (
      <button className="bg-gray-400
                         text-white font-bold py-2 px-4 rounded">
	    {(videoInput == false) ? "Camera on" : "Camera off"}</button>
    );
  } else if ( videoInput == false ) {
    cameraButton = (
      <button className="bg-green-500 hover:bg-green-600
                         text-white font-bold py-2 px-4 rounded"
              onClick={() => setVideoInput(true)}>Camera on</button>
    );
  } else {
    cameraButton = (
      <button className="bg-red-500 hover:bg-red-600
                         text-white font-bold py-2 px-4 rounded"
              onClick={() => setVideoInput(false)}>Camera off</button>
    );
  }

  const element = (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="flex flex-row h-[320px]">
        <div className="w-[400px] flex-shrink-0 bg-white shadow-lg p-4 overflow-y-auto">
          <div className="text-2xl font-bold text-gray-800">
            Gemini Live API Web Console
          </div>
	  <br/>
	  <div className="flex flex-row space-x-4 items-center">
            <div>{connectButton}</div>
            <div>{micButton}</div>
            <div>{cameraButton}</div>
	  </div>
	  <br/>
	  <div className="flex flex-row space-x-4 items-center">
            <div><ToggleSwitch id="responseModality"    
                               labelLeft="Text" labelRight="Audio"
                               setValue={setResponseModality}
                               disabled={isNotDisconnected}
                               isRight={false} />
            </div>
            <div><DropdownMenu options={[
                               { value: "English", label: "English" },
                               { value: "Japanese", label: "日本語" },
                               { value: "Korean", label: "한국어" },
                             ]} 
                               placeholder={outputLanguage}
                               disabled={isNotDisconnected}
                               onSelect={(option) => setOutputLanguage(option.value)} />
            </div>
	  </div>
	  <br/>
	  <div className="flex flex-row space-x-4 items-center">
            <div><ToggleSwitch id="setGoogleSearch"    
                               labelLeft="Off" labelRight="On"
                               setValue={setGoogleSearch}
                               disabled={isNotDisconnected}
                               isRight={false} />
            </div>
            <div className="text-1xl font-bold text-gray-800">
	    Google Search</div>  
	  </div>
        </div>
        <div className="flex-grow flex items-center justify-center p-4 bg-white">
          <div id="video-preview">
            <video id="video" width="320" className="bg-black"
                   autoPlay playsInline muted></video>
            <canvas id="canvas" hidden></canvas>
          </div>
        </div>
      </div>
      <div className="flex-grow bg-gray-50 border-t p-6 overflow-y-auto">
        <TextChat
          sendTextMessage={sendTextMessage}
          newModelMessage={newModelMessage}
          setNewModelMessage={setNewModelMessage}
          connectionStatus={connectionStatus}
        />
      </div>
    </div>
  );
  return element;
}
