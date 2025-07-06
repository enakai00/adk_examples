import { useState, useRef, useEffect } from "react";

export default function TextChat(props) {

  const newModelMessage = props.newModelMessage;
  const setNewModelMessage = props.setNewModelMessage;

  const messageEnd = useRef(null);
  const inputRef = useRef(null);
  const [chatData, setChatData] = useState([]);
  const [buttonDisabled, setButtonDisabled] = useState(true);
  const [inputText, setInputText] = useState("");

  useEffect(() => {
    if (newModelMessage) {
      handleNewMessage();
    }
  }, [newModelMessage]);

  useEffect(() => {
    if (props.connectionStatus == "connected") {
      setChatData([]);
      setButtonDisabled(false);
    } else {
      setButtonDisabled(true);
    }
  }, [props.connectionStatus]);

  // Automatically scrolling up to show the last message.
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  useEffect(() => {
    const scrollUp = async () => {
      await sleep(200);
      messageEnd.current?.scrollIntoView();
    };
    scrollUp();
  });

  const handleNewMessage = () => {
    if (newModelMessage == "") {
      return;
    }
    let chatDataNew = chatData.concat(); // clone an array
    const lastMessage = chatDataNew.at(-1);
    if (lastMessage && lastMessage.role == "model"
        && lastMessage.timestamp > Date.now()-1000) {
      lastMessage.text += newModelMessage;
      lastMessage.timestamp = Date.now();
    } else {
      chatDataNew.push({
        "role": "model",
        "text": newModelMessage,
        "timestamp": Date.now(),
      });
    }
    setChatData(chatDataNew);
    setNewModelMessage("");
  };

  const sendText = async () => {
    setButtonDisabled(true);
    let chatDataNew = chatData.concat(); // clone an array
    chatDataNew.push({
      "role": "user",
      "text": inputText,
      "timestamp": Date.now(),
    });
    setChatData(chatDataNew);
    props.sendTextMessage(inputText); // Send text to live API
    setInputText("");
    setButtonDisabled(false);
  };

  const textStyle = {
    width: "500px", padding: "10px", marginBottom: "20px",
    border: "1px solid #333333", borderRadius: "10px",
  };
  const chatBody = [];
  let i = 0;
  for (const item of chatData) {
    i += 1;

    if (item.role === "model") {
      let elem;
      elem = (
        <div key={i} style={textStyle}>
          {item.text}
        </div>
      );
      chatBody.push(elem);
    }

    if (item.role === "user") {
      const elem = (
          <div key={i} align="right">
            <div style={textStyle}>
              {item.text}
            </div>
          </div>
      );
      chatBody.push(elem);
    }
  }

  let inputElement;
  if (buttonDisabled == false) {
    inputElement = (
      <>
      <div align="right">
        <textarea className="py-2 px-4 border border-blue-300
                             focus:border-blue-500 focus:ring
                             focus:ring-blue-200 focus:ring-opacity-50
                             rounded-md outline-none shadow-sm
                             w-[500px] h-[80px] resize-none"
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)} />
      </div>            
      <div align="right">
        <button className="bg-blue-500 hover:bg-blue-700
                           text-white font-bold py-2 px-4 rounded"
                onClick={sendText}>Send</button>
      </div>
      </>
    );
  } else {
    inputElement = (<></>);
  }

  const element = (
    <>
      {chatBody}
      {inputElement}
      <div ref={messageEnd} />
    </>
  );

  return element;
}
