class GeminiLiveResponseMessage {
  constructor(data) {
    this.data = [];
    this.type = [];
    this.endOfTurn = data?.serverContent?.turnComplete;

    if (data?.setupComplete) {
      this.data.push("");
      this.type.push("SETUP COMPLETE");
    }

    const parts = data?.serverContent?.modelTurn?.parts;
    if (! parts?.length) {
      return;
    }
    parts.forEach((part) => {
      if (part.text) {
        this.data.push(part.text);
        this.type.push("TEXT");
      } else if (part.inlineData) {
        this.data.push(part.inlineData.data);
        this.type.push("AUDIO");
      }
    });
  }
}


export class GeminiLiveAPI {
  constructor(proxyUrl, projectId, model, apiHost) {
    this.proxyUrl = proxyUrl;

    this.projectId = projectId;
    this.model = model;
    this.modelUri = `projects/${this.projectId}/locations/us-central1/publishers/google/models/${this.model}`;

    this.responseModalities = ["AUDIO"];
    this.systemInstructions = "";

    this.apiHost = apiHost;
    this.serviceUrl = `wss://${this.apiHost}/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;

    this.onReceiveResponse = (message) => {
      console.log("Default message received callback", message);
    };

    this.onConnectionStarted = () => {
      console.log("Default onConnectionStarted");
    };

    this.onErrorMessage = (message) => {
      alert(message);
    };

    this.accessToken = "";
    this.webSocket = null;
  }

  isConnected() {
    if (this.webSocket === null) return false;
    return this.webSocket.readyState;
  }

  setProjectId(projectId) {
    this.projectId = projectId;
    this.modelUri = `projects/${this.projectId}/locations/us-central1/publishers/google/models/${this.model}`;
  }

  setAccessToken(newAccessToken) {
    console.log("setting access token: ", newAccessToken);
    this.accessToken = newAccessToken;
  }

  setGoogleSearch(googleSearch) {
    this.googleSearch = googleSearch;
  }

  connect(accessToken) {
    this.setAccessToken(accessToken);
    this.setupWebSocketToService();
  }

  disconnect() {
    this.webSocket.close();
  }

  sendMessage(message) {
    this.webSocket.send(JSON.stringify(message));
  }

  onReceiveMessage(messageEvent) {
    console.log("Message received: ", messageEvent);
    const messageData = JSON.parse(messageEvent.data);
    if (messageData?.setupComplete) {
      this.onConnectionStarted();
    }
    const message = new GeminiLiveResponseMessage(messageData);
    this.onReceiveResponse(message);
  }

  setupWebSocketToService() {
    console.log("connecting: ", this.proxyUrl);

    this.webSocket = new WebSocket(this.proxyUrl);

    this.webSocket.onclose = (event) => {
      console.log("websocket closed: ", event);
      this.onErrorMessage("Connection closed");
    };

    this.webSocket.onerror = (event) => {
      console.log("websocket error: ", event);
      this.onErrorMessage("Connection error");
    };

    this.webSocket.onopen = (event) => {
      console.log("websocket open: ", event);
      this.sendInitialSetupMessages();
    };

    this.webSocket.onmessage = this.onReceiveMessage.bind(this);
  }

  sendInitialSetupMessages() {
    const serviceSetupMessage = {
      bearer_token: this.accessToken,
      service_url: this.serviceUrl,
    };
    this.sendMessage(serviceSetupMessage);

    let tools = [];
    if (this.googleSearch) tools = [{googleSerch: {}}];
    console.log("tools: ", tools);
    const sessionSetupMessage = {
      setup: {
        model: this.modelUri,
        generation_config: {
          response_modalities: this.responseModalities,
        },
        system_instruction: {
          parts: [{ text: this.systemInstructions }],
        },
        tools: tools,
      },
    };
    this.sendMessage(sessionSetupMessage);
  }

  sendTextMessage(text) {
    const textMessage = {
      client_content: {
        turns: [
          {
            role: "user",
            parts: [{ text: text }],
          },
        ],
        turn_complete: true,
      },
    };
    this.sendMessage(textMessage);
  }

  sendRealtimeInputMessage(data, mime_type) {
    const message = {
      realtime_input: {
        media_chunks: [
          {
            mime_type: mime_type,
            data: data,
          },
        ],
      },
    };
    this.sendMessage(message);
  }

  sendAudioMessage(base64PCM) {
    this.sendRealtimeInputMessage(base64PCM, "audio/pcm");
  }

  sendImageMessage(base64Image, mime_type = "image/jpeg") {
    this.sendRealtimeInputMessage(base64Image, mime_type);
  }
}
