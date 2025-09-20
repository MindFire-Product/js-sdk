import {
  RealtimeAgent,
  RealtimeSession,
  tool,
} from "https://cdn.jsdelivr.net/npm/@openai/agents-realtime@0.1.1/+esm";

/**
 * VoiceChatComponent - A web component for voice-based AI conversations
 * @class VoiceChatComponent
 * @extends HTMLElement
 *
 * @example
 * // 3 steps to use the component:
 * // 1. Add the component to your HTML
 * <voice-chat-component data-agent-id="your-agent-id"></voice-chat-component>
 * 
 * // 2. Load the script
 * <script src="voice-chat-component.js" type="module"></script>
 * 
 * // 3. Optionally set visitor info
 * <script>
 *   const voiceComponent = document.querySelector('voice-chat-component');
 *   voiceComponent.visitorInfo = {
 *     name: "John Doe",
 *     email: "john@example.com",
 *     phone: "1234567890"
 *   };
 * </script>
 *
 * @example
 * // Listening to events from external JavaScript
 * const voiceComponent = document.querySelector('voice-chat-component');
 *
 * // Listen to session events using their original names
 * voiceComponent.addEventListener('session.created', (event) => {
 *   console.log('Session created:', event.detail);
 * });
 *
 * voiceComponent.addEventListener('response.output_audio_transcript.done', (event) => {
 *   console.log('Agent said:', event.detail.transcript);
 * });
 *
 * voiceComponent.addEventListener('conversation.item.input_audio_transcription.completed', (event) => {
 *   console.log('User said:', event.detail.transcript);
 * });
 *
 * voiceComponent.addEventListener('output_audio_buffer.started', (event) => {
 *   console.log('Agent started speaking');
 * });
 *
 * voiceComponent.addEventListener('error', (event) => {
 *   console.error('Session error:', event.detail);
 * });
 *
 * @event session.created - Session created event
 * @event output_audio_buffer.started - Agent started speaking
 * @event output_audio_buffer.stopped - Agent stopped speaking
 * @event response.output_audio_transcript.done - Agent speech transcribed
 * @event conversation.item.input_audio_transcription.completed - User speech transcribed
 * @event error - Session error occurred
 */
class VoiceChatComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    // Initialize component state
    this._initializeState();

    // This handles the case where visitorInfo is set on the element
    // before the component is fully defined and upgraded.
    this._upgradeProperty("visitorInfo");

    // Bind methods to preserve context
    this._bindMethods();

    // Render initial UI
    this.render();
    this.setupEventListeners();
  }

  /**
   * Initialize component state and configuration
   * @private
   */
  _initializeState() {
    // No default agent configuration - will be loaded from server
    this.agentConfig = null;

    // Default visitor information
    this._visitorInfo = {};

    // Component configuration
    this.agentId = null;
    this.isConfigLoaded = false;
    this.apiBaseUrl = "https://z-server-stg.uc.r.appspot.com/api";
    // this.apiBaseUrl = "http://localhost:8000/api";
    this.apiVersion = "v1";

    // Component state
    this.session = null;
    this.agent = null;
    this.sessionConnected = false;
    this.isMuted = false;
    this.isAgentSpeaking = false;
    this.originalGetUserMedia = null;
    this.capturedStream = null;
    this.isDestroyed = false;
  }

  /**
   * Ensures that properties set on the element before it was upgraded
   * are applied to the class instance.
   * @private
   * @param {string} prop - The name of the property to upgrade.
   */
  _upgradeProperty(prop) {
    if (this.hasOwnProperty(prop)) {
      let value = this[prop];
      delete this[prop];
      this[prop] = value;
    }
  }

  /**
   * Bind methods to preserve context
   * @private
   */
  _bindMethods() {
    this.startConversation = this.startConversation.bind(this);
    this.stopConversation = this.stopConversation.bind(this);
    this.toggleMute = this.toggleMute.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  /**
   * Emit custom event to external listeners
   * @private
   * @param {string} eventType - The event type to emit
   * @param {Object} eventData - The event data to pass to listeners
   */
  _emit(eventType, eventData) {
    if (this.isDestroyed) return;

    // Emit as DOM custom event for external JavaScript to listen to
    const customEvent = new CustomEvent(eventType, {
      detail: eventData,
      bubbles: true,
      cancelable: true,
    });
    this.dispatchEvent(customEvent);
  }

  connectedCallback() {
    // The component is now connected to the DOM.
    // We read the agent ID from the attribute one time and load its configuration.
    const agentId = this.getAttribute("data-agent-id");
    if (agentId && typeof agentId === "string") {
      this.agentId = agentId.trim();
      this.loadAgentConfiguration();
    } else {
      console.error(
        "VoiceChatComponent Error: `data-agent-id` attribute is missing or invalid."
      );
      // Hide the component if no valid agent ID is provided
      this.hideComponent();
    }
  }

  disconnectedCallback() {
    try {
      this.cleanup();
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }

  /**
   * Cleanup resources and event listeners
   * @private
   */
  cleanup() {
    this.isDestroyed = true;

    // Stop any active session
    if (this.session) {
      this.session.close();
      this.session = null;
    }

    // Stop media stream
    if (this.capturedStream) {
      this.capturedStream.getTracks().forEach((track) => track.stop());
      this.capturedStream = null;
    }

    // Restore original getUserMedia
    if (this.originalGetUserMedia) {
      navigator.mediaDevices.getUserMedia = this.originalGetUserMedia;
      this.originalGetUserMedia = null;
    }

    // Remove event listeners
    document.removeEventListener("keydown", this.handleKeyDown);
  }

  /**
   * Handle errors with proper logging and user feedback
   * @private
   * @param {string} message - Error message
   * @param {Error} error - Original error object
   */
  _handleError(message, error = null) {
    console.error(message, error);

    // Update UI to show error state
    const permissionState = this.shadowRoot?.querySelector("#permission-state");
    if (permissionState) {
      permissionState.textContent = message;
      permissionState.style.color = "#dc2626";
    }

    // Update connection status
    this.updateConnectionStatus(false);
  }

  /**
   * Get visitor information
   * @returns {Object} Current visitor information
   */
  get visitorInfo() {
    return this._visitorInfo || {};
  }

  /**
   * Set visitor information
   * @param {Object} value - Visitor information object. Must be a non-null object.
   */
  set visitorInfo(value) {
    // Validate that the incoming value is a non-null object
    if (value && typeof value === "object" && value !== null) {
      this._visitorInfo = value;
    } else {
      // If the value is invalid but not null/undefined, warn the developer
      if (value) {
        console.warn(
          `Failed to set visitorInfo: value must be an object. Received type: ${typeof value}`
        );
      }
      // Reset to a default empty object
      this._visitorInfo = {};
    }
  }

  /**
   * Load agent configuration with proper error handling
   * @async
   */
  async loadAgentConfiguration() {
    if (!this.agentId || this.isDestroyed) {
      return;
    }

    try {
      console.log(`Loading configuration for agent: ${this.agentId}`);

      const data = await this._fetchAgentConfiguration();

      if (data) {
        await this._processAgentConfiguration(data);
      } else {
        this._handleAgentNotFound();
      }
    } catch (error) {
      console.error("Error loading agent configuration:", error);
      this.hideComponent();
    }
  }

  /**
   * Fetch agent configuration from API (future implementation)
   * @private
   * @async
   * @returns {Promise<Object>} Agent configuration data
   */
  async _fetchAgentConfiguration() {
    const response = await fetch(
      `${this.apiBaseUrl}/${this.apiVersion}/agents/${this.agentId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        // Add timeout
        signal: AbortSignal.timeout(10000), // 10 second timeout
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Process and apply agent configuration
   * @private
   * @async
   * @param {Object} data - Agent configuration data
   */
  async _processAgentConfiguration(data) {
    // Check if agent is active
    if (data.is_active === false) {
      console.log(`Agent ${this.agentId} is not active - hiding component`);
      this.hideComponent();
      return;
    }

    // Validate required fields
    if (!data.name || !data.voice) {
      throw new Error("Invalid agent configuration: missing required fields");
    }
    
    // Update agent config with server data
    this.agentConfig = data;
    
    // Mark as loaded
    this.isConfigLoaded = true;

    // Re-render with new configuration
    this.render();
    this.setupEventListeners();

    console.log("Agent configuration loaded successfully:", data);
  }

  /**
   * Handle case when agent is not found
   * @private
   */
  _handleAgentNotFound() {
    console.error(`Agent configuration not found for ID: ${this.agentId}`);
    this.hideComponent();
  }



  hideComponent() {
    // Hide the entire component when agent is not active
    this.style.display = "none";
    console.log("Component hidden - agent is not active");
  }

  showComponent() {
    // Show the component when agent becomes active
    this.style.display = "";
    console.log("Component shown - agent is active");
  }

  render() {
    // Show loading spinner if no agent config is loaded
    if (!this.agentConfig) {
      this.shadowRoot.innerHTML = `
          <style>
            :host {
              --primary-color: #007bff;
              --text-color: #1f2937;
              --font-family: "Arial", sans-serif;
            }
            
            * { 
              margin: 0; 
              padding: 0; 
              box-sizing: border-box; 
            }
            
            .loading-container {
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
              font-family: var(--font-family);
            }
            
            .loading {
              display: inline-block;
              width: 20px;
              height: 20px;
              border: 2px solid #f3f3f3;
              border-top: 2px solid var(--primary-color);
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin-right: 8px;
            }
            
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            
            .loading-text {
              color: var(--text-color);
              font-size: 14px;
            }
          </style>
          
          <div class="loading-container">
            <div class="loading"></div>
            <span class="loading-text">Loading ...</span>
          </div>
        `;
      return;
    }

    const agentFirstName =
      this.agentConfig.name.split(" ")[0] || "AI Assistant";
    const buttonText = this.agentConfig.theme.button_text.replace(
      "{agentName}",
      agentFirstName
    );

    this.shadowRoot.innerHTML = `
              <style>
                  :host {
                      --button-bg-color: ${
                        this.agentConfig.theme.primary_color
                      };
                      --primary-color: ${this.agentConfig.theme.primary_color};
                      --text-color: ${this.agentConfig.theme.text_color};
                      --secondary-text-color: #6b7280;
                      --modal-bg-color: #ffffff;
                      --border-radius: ${this.agentConfig.theme.border_radius};
                      --font-family: ${this.agentConfig.theme.font_family};
                      --sound-wave-color: ${
                        this.agentConfig.theme.primary_color
                      };
                      --sound-wave-active-color: ${
                        this.agentConfig.theme.primary_color
                      };
                  }
                  
                  * { 
                      margin: 0; 
                      padding: 0; 
                      box-sizing: border-box; 
                  }
                  
                  /* Start Button Styles */
                  .start-button {
                      display: flex;
                      align-items: center;
                      gap: 12px;
                      padding: 12px 20px;
                      background: var(--button-bg-color);
                      color: var(--text-color);
                      border: none;
                      border-radius: var(--border-radius);
                      font-size: 14px;
                      font-weight: 500;
                      font-family: var(--font-family);
                      cursor: pointer;
                      box-shadow: 0 4px 20px rgba(0,123,255,0.3);
                      transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55), box-shadow 0.3s ease;
                      min-height: 44px;
                  }
                  
                  .start-button.loading {
                      transition: none;
                      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                      cursor: default;
                      transform: none !important;
                      border: 1px solid #d1d5db;
                  }
                  
                  .start-button:hover:not(.loading) {
                      transform: translateY(-2px);
                      box-shadow: 0 6px 25px rgba(0,123,255,0.4);
                  }
                  
                  .start-button:active {
                      transform: translateY(0);
                  }
                  
                  
                  .start-button .avatar {
                      width: 32px;
                      height: 32px;
                      border-radius: 50%;
                      object-fit: cover;
                      display: ${
                        this.agentConfig.theme.show_avatar ? "block" : "none"
                      };
                  }
                  
                  /* Modal Overlay */
                  .modal-overlay {
                      position: fixed;
                      top: 0;
                      left: 0;
                      width: 100%;
                      height: 100%;
                      background: rgba(0, 0, 0, 0.5);
                      display: none;
                      align-items: center;
                      justify-content: center;
                      z-index: 10000;
                      backdrop-filter: blur(1px);
                      font-family: var(--font-family);
                  }
                  
                  .modal-overlay.show {
                      display: flex;
                  }
                  
                  /* Modal Content */
                  .modal {
                      background: var(--modal-bg-color);
                      border-radius: 20px;
                      padding: 32px;
                      width: 90%;
                      max-width: 400px;
                      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                      text-align: center;
                      position: relative;
                      transform: scale(0.7);
                      opacity: 0;
                      transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                  }
                  
                  .modal-overlay.show .modal {
                      transform: scale(1);
                      opacity: 1;
                  }
                  
                  /* Agent Header */
                  .agent-header {
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      justify-content: center;
                      gap: 16px;
                      margin-bottom: 32px;
                  }
                  
                  .agent-avatar {
                      width: 120px;
                      height: 120px;
                      border-radius: 50%;
                      object-fit: cover;
                      display: ${
                        this.agentConfig.theme.show_avatar ? "block" : "none"
                      };
                  }
                  
                  .agent-info {
                      text-align: center;
                  }
                  
                  .agent-name {
                      font-size: 18px;
                      font-weight: 600;
                      color: var(--text-color);
                      margin: 0;
                  }
                  
                  .connection-status .loading {
                      width: 16px;
                      height: 16px;
                      border-width: 2px;
                  }
                  
                  .connection-status {
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      gap: 6px;
                      margin-top: 4px;
                  }
                  
                  .status-dot {
                      width: 8px;
                      height: 8px;
                      border-radius: 50%;
                      background: #9ca3af;
                      transition: background 0.3s ease;
                  }
                  
                  .status-dot.connected {
                      background: #4ade80;
                  }
                  
                  .status-text {
                      font-size: 12px;
                      color: var(--secondary-text-color);
                      font-weight: 500;
                  }
                  
                  /* Sound Wave Animation */
                  .sound-wave-container {
                      height: 100px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      margin: 32px 0;
                  }
                  
                  .sound-wave {
                      display: flex;
                      align-items: center;
                      gap: 4px;
                      opacity: 1;
                      transition: all 0.3s ease;
                      height: 60px;
                  }
                  
                  .wave-bar {
                      width: 4px;
                      background: var(--sound-wave-color);
                      border-radius: 2px;
                      height: 2px;
                      transition: height 0.3s ease, background-color 0.3s ease;
                      opacity: 0.4;
                  }
                  
                  .sound-wave.active .wave-bar {
                      animation: wave-active 1.2s ease-in-out infinite;
                      opacity: 1;
                      background: var(--sound-wave-active-color);
                  }
                  
                  .sound-wave.active .wave-bar:nth-child(1) { height: 15px; animation-delay: 0s; }
                  .sound-wave.active .wave-bar:nth-child(2) { height: 25px; animation-delay: 0.1s; }
                  .sound-wave.active .wave-bar:nth-child(3) { height: 40px; animation-delay: 0.2s; }
                  .sound-wave.active .wave-bar:nth-child(4) { height: 50px; animation-delay: 0.3s; }
                  .sound-wave.active .wave-bar:nth-child(5) { height: 35px; animation-delay: 0.4s; }
                  .sound-wave.active .wave-bar:nth-child(6) { height: 45px; animation-delay: 0.5s; }
                  .sound-wave.active .wave-bar:nth-child(7) { height: 20px; animation-delay: 0.6s; }
                  .sound-wave.active .wave-bar:nth-child(8) { height: 18px; animation-delay: 0.7s; }
                  
                  @keyframes wave-active {
                      0%, 100% { 
                          transform: scaleY(0.3); 
                          opacity: 0.7; 
                      }
                      50% { 
                          transform: scaleY(1.2); 
                          opacity: 1; 
                      }
                  }
                  
                  /* Control Buttons */
                  .controls {
                      display: flex;
                      gap: 24px;
                      justify-content: center;
                      margin-top: 32px;
                  }

                  .control-item {
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      gap: 8px;
                  }
                  
                  .control-btn {
                      width: 56px;
                      height: 56px;
                      border: none;
                      border-radius: 50%;
                      cursor: pointer;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 20px;
                      transition: all 0.2s ease;
                      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                  }

                  .control-btn:hover {
                      transform: translateY(-1px);
                  }
                  
                  .mute-btn {
                      background: #6b7280;
                      color: white;
                  }
                  
                  .mute-btn:hover {
                      background: #4b5563;
                  }
                  
                  .mute-btn.muted {
                      background: #f59e0b;
                  }
                  
                  .stop-btn {
                      background: #dc2626;
                      color: white;
                  }
                  
                  .stop-btn:hover {
                      background: #b91c1c;
                  }

                  .control-label {
                      font-size: 12px;
                      font-weight: 500;
                      color: var(--secondary-text-color);
                      font-family: var(--font-family);
                  }
                  
                  /* Permission State */
                  .permission-state {
                      text-align: center;
                      color: var(--secondary-text-color);
                      font-size: 14px;
                      margin-top: 16px;
                  }
                  
                  /* Loading State */
                  .loading {
                      display: inline-block;
                      width: 20px;
                      height: 20px;
                      border: 2px solid #f3f3f3;
                      border-top: 2px solid var(--primary-color);
                      border-radius: 50%;
                      animation: spin 1s linear infinite;
                      vertical-align: middle;
                  }
                  
                  @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                  }
                  
                  /* Responsive Design */
                  @media (max-width: 768px) {
                      .modal {
                          margin: 16px;
                          padding: 24px;
                          max-width: calc(100vw - 32px);
                      }
                      
                      .start-button {
                          font-size: 14px;
                          padding: 14px 20px;
                          gap: 8px;
                      }
                      
                      .agent-header {
                          flex-direction: column;
                          text-align: center;
                          gap: 16px;
                      }
                      
                      .controls {
                          gap: 12px;
                      }
                      
                      .control-btn {
                          width: 48px;
                          height: 48px;
                          font-size: 18px;
                      }
                  }
                  
                  @media (max-width: 480px) {
                      .modal {
                          margin: 12px;
                          padding: 20px;
                          max-width: calc(100vw - 24px);
                      }
                      
                      .start-button {
                          font-size: 13px;
                          padding: 12px 16px;
                          gap: 6px;
                      }
                      
                      .start-button .avatar {
                          width: 28px;
                          height: 28px;
                      }
                      
                      .agent-avatar {
                          width: 60px;
                          height: 60px;
                      }
                      
                      .agent-name {
                          font-size: 16px;
                      }
                      
                      .sound-wave-container {
                          height: 80px;
                          margin: 24px 0;
                      }
                      
                      .sound-wave {
                          height: 60px;
                      }
                      
                      .controls {
                          gap: 8px;
                          margin-top: 24px;
                      }
                      
                      .control-btn {
                          width: 44px;
                          height: 44px;
                          font-size: 16px;
                      }
                  }
                  
                  @media (max-width: 320px) {
                      .modal {
                          margin: 8px;
                          padding: 16px;
                          max-width: calc(100vw - 16px);
                      }
                      
                      .start-button {
                          font-size: 12px;
                          padding: 10px 14px;
                      }
                      
                      .agent-name {
                          font-size: 14px;
                      }
                      
                      .status-text {
                          font-size: 11px;
                      }
                  }
                  
                  /* High DPI displays */
                  @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
                      .start-button {
                          box-shadow: 0 2px 10px rgba(0,123,255,0.3);
                      }
                      
                      .start-button:hover {
                          box-shadow: 0 3px 15px rgba(0,123,255,0.4);
                      }
                  }
                  
                  /* Reduced motion preferences */
                  @media (prefers-reduced-motion: reduce) {
                      .start-button,
                      .control-btn,
                      .modal,
                      .wave-bar {
                          transition: none;
                          animation: none;
                      }
                      
                      .sound-wave.active .wave-bar {
                          animation: none;
                          height: 20px;
                          opacity: 0.6;
                      }
                  }
                  
                  /* Dark mode support */
                  @media (prefers-color-scheme: dark) {
                      :host {
                          --modal-bg-color: #1f2937;
                          --text-color: #f9fafb;
                          --secondary-text-color: #d1d5db;
                      }
                  }
              </style>
              
              <!-- Start Conversation Button -->
              <button 
                  class="start-button" 
                  id="start-button"
                  aria-label="${buttonText}"
                  role="button"
                  tabindex="0"
                  ${this.isConfigLoaded ? "" : "disabled"}
              >
                  ${
                    this.agentConfig.theme.show_avatar &&
                    this.agentConfig.avatar_url
                      ? `<img class="avatar" src="${this.agentConfig.avatar_url}" alt="Agent Avatar" loading="lazy">`
                      : ""
                  }
                  <span style="font-weight: bold;">${buttonText}</span>
              </button>
  
              <!-- Modal Overlay -->
              <div 
                  class="modal-overlay" 
                  id="modal-overlay"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="modal-agent-name"
                  aria-describedby="status-text"
                  tabindex="-1"
              >
                  <div class="modal">
                      <!-- Agent Header -->
                      <div class="agent-header">
                          ${
                            this.agentConfig.theme.show_avatar &&
                            this.agentConfig.avatar_url
                              ? `<img class="agent-avatar" src="${this.agentConfig.avatar_url}" alt="Agent Avatar" id="modal-avatar" loading="lazy">`
                              : ""
                          }
                          <div class="agent-info">
                              <h3 class="agent-name" id="modal-agent-name">${
                                this.agentConfig.name
                              }</h3>
                              <div class="connection-status">
                                  <div class="loading" id="connection-loader" style="display: none;"></div>
                                  <div 
                                      class="status-dot" 
                                      id="status-dot"
                                      aria-label="Connection status"
                                      role="status"
                                  ></div>
                                  <span class="status-text" id="status-text">Connecting...</span>
                              </div>
                          </div>
                      </div>
  
                      <!-- Sound Wave Indicator -->
                      <div 
                          class="sound-wave-container"
                          aria-label="Audio activity indicator"
                          role="status"
                          aria-live="polite"
                      >
                          <div class="sound-wave" id="sound-wave" aria-hidden="true">
                              <div class="wave-bar"></div>
                              <div class="wave-bar"></div>
                              <div class="wave-bar"></div>
                              <div class="wave-bar"></div>
                              <div class="wave-bar"></div>
                              <div class="wave-bar"></div>
                              <div class="wave-bar"></div>
                              <div class="wave-bar"></div>
                          </div>
                      </div>
  
                      <!-- Control Buttons -->
                      <div class="controls" role="toolbar" aria-label="Voice conversation controls">
                          <div class="control-item">
                              <button 
                                  class="control-btn mute-btn" 
                                  id="mute-btn" 
                                  title="Mute microphone"
                                  aria-label="Mute microphone"
                                  role="button"
                                  tabindex="0"
                              >
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                      <path d="M12 2C10.34 2 9 3.34 9 5V11C9 12.66 10.34 14 12 14C13.66 14 15 12.66 15 11V5C15 3.34 13.66 2 12 2Z" fill="currentColor"/>
                                      <path d="M19 11C19 15.41 15.41 19 11 19V21H13V23H11H9V21H11V19C6.59 19 3 15.41 3 11H5C5 14.31 7.69 17 11 17H13C16.31 17 19 14.31 19 11H19Z" fill="currentColor"/>
                                  </svg>
                              </button>
                              <span class="control-label" id="mute-btn-label">Mute</span>
                          </div>
                          <div class="control-item">
                              <button 
                                  class="control-btn stop-btn" 
                                  id="stop-btn" 
                                  title="End conversation"
                                  aria-label="End conversation"
                                  role="button"
                                  tabindex="0"
                              >
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
                                  </svg>
                              </button>
                              <span class="control-label">Stop</span>
                          </div>
                      </div>
  
                      <!-- Permission State -->
                      <div 
                          class="permission-state" 
                          id="permission-state"
                          role="status"
                          aria-live="polite"
                      ></div>
                  </div>
              </div>
          `;
  }

  /**
   * Setup event listeners with proper cleanup and accessibility
   */
  setupEventListeners() {
    // Remove existing listeners to prevent duplicates
    this._removeEventListeners();

    const listeners = [
      {
        selector: "#start-button",
        event: "click",
        handler: this.startConversation,
      },
      {
        selector: "#start-button",
        event: "keydown",
        handler: this._handleButtonKeyDown,
      },
      { selector: "#stop-btn", event: "click", handler: this.stopConversation },
      {
        selector: "#stop-btn",
        event: "keydown",
        handler: this._handleButtonKeyDown,
      },
      { selector: "#mute-btn", event: "click", handler: this.toggleMute },
      {
        selector: "#mute-btn",
        event: "keydown",
        handler: this._handleButtonKeyDown,
      },
    ];

    listeners.forEach(({ selector, event, handler }) => {
      const element = this.shadowRoot?.querySelector(selector);
      element?.addEventListener(event, handler.bind(this));
    });

    // Handle ESC key to close modal
    document.addEventListener("keydown", this.handleKeyDown);
  }

  /**
   * Remove event listeners to prevent memory leaks
   * @private
   */
  _removeEventListeners() {
    const listeners = [
      {
        selector: "#start-button",
        event: "click",
        handler: this.startConversation,
      },
      {
        selector: "#start-button",
        event: "keydown",
        handler: this._handleButtonKeyDown,
      },
      { selector: "#stop-btn", event: "click", handler: this.stopConversation },
      {
        selector: "#stop-btn",
        event: "keydown",
        handler: this._handleButtonKeyDown,
      },
      { selector: "#mute-btn", event: "click", handler: this.toggleMute },
      {
        selector: "#mute-btn",
        event: "keydown",
        handler: this._handleButtonKeyDown,
      },
    ];

    listeners.forEach(({ selector, event, handler }) => {
      const element = this.shadowRoot?.querySelector(selector);
      element?.removeEventListener(event, handler.bind(this));
    });

    document.removeEventListener("keydown", this.handleKeyDown);
  }


  /**
   * Handle keyboard events
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyDown(e) {
    const modalOverlay = this.shadowRoot?.querySelector("#modal-overlay");

    if (e.key === "Escape" && modalOverlay?.classList.contains("show")) {
      e.preventDefault();
      this.stopConversation();
    }
  }

  /**
   * Handle button keyboard events for accessibility
   * @private
   * @param {KeyboardEvent} e - Keyboard event
   */
  _handleButtonKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.target.click();
    }
  }

  async getEphemeralKey() {
    try {
      if (!this.agentConfig) {
        throw new Error("Agent configuration not loaded");
      }
      const url = `${this.apiBaseUrl}/${this.apiVersion}/llms/token/${this.agentConfig.voice}`;
      const response = await fetch(url);
      const data = await response.json();
      return data.ephemeral_key;
    } catch (error) {
      console.error("Error getting ephemeral key:", error);
      throw error;
    }
  }

  async requestMicrophonePermission() {
    const permissionState = this.shadowRoot.querySelector("#permission-state");
    
    try {
      permissionState.innerHTML =
        '<div class="loading" style="display: inline-block; margin-right: 8px; vertical-align: middle;"></div> Requesting microphone access...';

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      permissionState.textContent = "";
      return true;
    } catch (error) {
      console.error("Microphone permission denied:", error);
      permissionState.textContent =
        "Microphone access is required for voice conversation.";
      return false;
    }
  }

  updateConnectionStatus(connected) {
    this.sessionConnected = connected;
    const statusDot = this.shadowRoot.querySelector("#status-dot");
    const statusText = this.shadowRoot.querySelector("#status-text");
    const loader = this.shadowRoot.querySelector("#connection-loader");

    if (loader) loader.style.display = "none";
    if (statusDot) statusDot.style.display = "block";

    if (connected) {
      statusDot?.classList.add("connected");
      if (statusText) statusText.textContent = "Connected";
    } else {
      statusDot?.classList.remove("connected");
      if (statusText) statusText.textContent = "Disconnected";
    }
  }

  toggleSoundWave(show) {
    this.isAgentSpeaking = show;
    const soundWave = this.shadowRoot.querySelector("#sound-wave");
    soundWave?.classList.toggle("active", show);
  }

  interceptGetUserMedia() {
    if (!this.originalGetUserMedia) {
      this.originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices
      );
      navigator.mediaDevices.getUserMedia = (constraints) => {
        return this.originalGetUserMedia(constraints).then((stream) => {
          if (constraints.audio) {
            this.capturedStream = stream;
            console.log("Captured media stream for mute control");
          }
          return stream;
        });
      };
    }
  }

  /**
   * Toggle microphone mute state
   */
  toggleMute() {
    if (!this.session || this.isDestroyed) return;

    try {
      this.isMuted = !this.isMuted;
      this._updateMuteButton();
      this._updateMicrophoneState();

      console.log(`Microphone ${this.isMuted ? "muted" : "unmuted"}`);
    } catch (error) {
      console.error("Error toggling mute:", error);
      // Revert mute state on error
      this.isMuted = !this.isMuted;
    }
  }

  /**
   * Update mute button UI
   * @private
   */
  _updateMuteButton() {
    const muteBtn = this.shadowRoot?.querySelector("#mute-btn");
    const muteLabel = this.shadowRoot?.querySelector("#mute-btn-label");
    if (!muteBtn || !muteLabel) return;

    muteBtn.classList.toggle("muted", this.isMuted);
    muteBtn.innerHTML = this._getMuteIcon(this.isMuted);
    muteLabel.textContent = this.isMuted ? "Muted" : "Mute";
    muteBtn.title = this.isMuted ? "Unmute microphone" : "Mute microphone";
    muteBtn.setAttribute("aria-pressed", this.isMuted.toString());
  }

  /**
   * Update microphone track state
   * @private
   */
  _updateMicrophoneState() {
    if (!this.capturedStream) return;

    const audioTracks = this.capturedStream.getAudioTracks();
    audioTracks.forEach((track) => {
      track.enabled = !this.isMuted;
    });
  }

  /**
   * Start a voice conversation with the AI agent
   * @async
   */
  async startConversation() {
    if (this.isDestroyed || this.session) {
      return;
    }

    try {
      // Validate configuration
      if (!this.isConfigLoaded || !this.agentConfig) {
        throw new Error("Agent configuration not loaded");
      }
      console.log(" **** ====== Agent configuration is:", this.agentConfig);

      // Show modal and update UI
      this._showModal();

      // Setup media capture
      this.interceptGetUserMedia();

      // Request microphone permission
      const hasPermission = await this.requestMicrophonePermission();
      if (!hasPermission) {
        this._hideModal();
        return;
      }

      // Get ephemeral key
      const ephemeralKey = await this.getEphemeralKey();

      // Build instructions
      const instructions = this._buildInstructions();

      const getRelevantInformationFromKnowledgeBase = tool({
        name: "getRelevantInformationFromKnowledgeBase",
        description:
          "Search the files for in the vector store (by vector store id) and return the response",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
          required: ["query"],
        },
        execute: async (query) => {
          const url = `${this.apiBaseUrl}/${this.apiVersion}/llms/kb/search`;

          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: query.query,
              vector_store_id: this.agentConfig.vector_store_id,
            }),
          });
          const data = await response.json();
          console.log("Relevant information from knowledge base:", data);
          return data;
        },
      });

      const tools = []
      if (this.agentConfig.has_file_search  && this.agentConfig.vector_store_id) {
        tools.push(getRelevantInformationFromKnowledgeBase)
      }
     
      // Create agent and session
      this.agent = new RealtimeAgent({
        name: this.agentConfig.name,
        instructions: instructions,
        tools: tools,
      });

      this.session = new RealtimeSession(this.agent, {
        model: "gpt-realtime",
        tracingDisabled: false,
      });

      // Setup event handlers
      this._setupSessionEventHandlers();

      // Connect to session
      await this.session.connect({ apiKey: ephemeralKey });
    } catch (error) {
      console.error("Error starting conversation:", error);
      this._handleConversationError(error);
    }
  }

  /**
   * Show modal and update UI state
   * @private
   */
  _showModal() {
    const modalOverlay = this.shadowRoot?.querySelector("#modal-overlay");
    const statusText = this.shadowRoot?.querySelector("#status-text");
    const statusDot = this.shadowRoot?.querySelector("#status-dot");
    const loader = this.shadowRoot?.querySelector("#connection-loader");

    if (modalOverlay) {
      modalOverlay.classList.add("show");
      // Focus the modal for accessibility
      modalOverlay.focus();
    }

    if (statusText) {
      statusText.textContent = "Connecting...";
    }
    if (statusDot) {
      statusDot.style.display = "none";
    }
    if (loader) {
      loader.style.display = "inline-block";
    }
  }

  /**
   * Hide modal
   * @private
   */
  _hideModal() {
    const modalOverlay = this.shadowRoot?.querySelector("#modal-overlay");
    if (modalOverlay) {
      modalOverlay.classList.remove("show");
    }
  }

  /**
   * Build instructions for the agent
   * @private
   * @returns {string} Complete instructions
   */
  _buildInstructions() {
    if (!this.agentConfig) {
      throw new Error("Agent configuration not loaded");
    }

    let instructions = this.agentConfig.instructions;

    // Add current date
    instructions += `\n\nToday's date is ${new Date().toLocaleDateString()}`;

    // Add visitor information if available
    if (this.visitorInfo && Object.keys(this.visitorInfo).length > 0) {
      instructions += `\n\nYou are assisting a person with the following information: ${JSON.stringify(
        this.visitorInfo
      )}`;
    }

    return instructions;
  }

  /**
   * Setup session event handlers
   * @private
   */
  _setupSessionEventHandlers() {
    if (!this.session) return;

    this.session.transport.on("*", (event) => {
      if (this.isDestroyed) return;

      // console.log("Session event:", event.type, event);

      // Emit session events for external listeners
      this._emit(event.type, event);

      switch (event.type) {
        case "session.created":
          this.updateConnectionStatus(true);
          // Send initial greeting after a short delay
          setTimeout(() => {
            if (this.session && !this.isDestroyed) {
              this.session.sendMessage("Hello!");
            }
          }, 100);
          break;

        case "output_audio_buffer.started":
          this.toggleSoundWave(true);
          break;

        case "output_audio_buffer.stopped":
          this.toggleSoundWave(false);
          break;

        case "response.output_audio_transcript.done":
          console.log("Agent:", event.transcript);
          break;

        case "conversation.item.input_audio_transcription.completed":
          console.log("User:", event.transcript);
          break;

        case "error":
          console.error("Session error:", event);
          this._handleSessionError(event);
          break;
      }
    });
  }

  /**
   * Handle conversation errors
   * @private
   * @param {Error} error - Error object
   */
  _handleConversationError(error) {
    this.updateConnectionStatus(false);
    this._hideModal();

    const permissionState = this.shadowRoot?.querySelector("#permission-state");
    if (permissionState) {
      let errorMessage = "Failed to start conversation. Please try again.";

      if (error.message.includes("permission")) {
        errorMessage =
          "Microphone permission is required for voice conversation.";
      } else if (error.message.includes("network")) {
        errorMessage =
          "Network error. Please check your connection and try again.";
      }

      permissionState.textContent = errorMessage;
    }
  }

  /**
   * Handle session errors
   * @private
   * @param {Object} event - Error event
   */
  _handleSessionError(event) {
    this.updateConnectionStatus(false);

    const permissionState = this.shadowRoot?.querySelector("#permission-state");
    if (permissionState) {
      permissionState.textContent = "Connection error. Please try again.";
    }
  }

  /**
   * Stop the current conversation and cleanup resources
   */
  stopConversation() {
    try {
      // Close session
      if (this.session) {
        this.session.close();
        this.session = null;
        this.agent = null;
      }

      // Stop media stream
      if (this.capturedStream) {
        this.capturedStream.getTracks().forEach((track) => {
          track.stop();
        });
        this.capturedStream = null;
      }

      // Restore original getUserMedia
      if (this.originalGetUserMedia) {
        navigator.mediaDevices.getUserMedia = this.originalGetUserMedia;
        this.originalGetUserMedia = null;
      }

      // Reset UI state
      const modalOverlay = this.shadowRoot?.querySelector("#modal-overlay");
      const muteBtn = this.shadowRoot?.querySelector("#mute-btn");
      const permissionState = this.shadowRoot?.querySelector("#permission-state");
      const loader = this.shadowRoot?.querySelector("#connection-loader");
      const statusDot = this.shadowRoot?.querySelector("#status-dot");

      // Hide modal
      if (modalOverlay) {
        modalOverlay.classList.remove("show");
      }

      // Reset connection indicator
      if (loader) {
        loader.style.display = "none";
      }
      if (statusDot) {
        statusDot.style.display = "block";
      }

      // Reset mute state
      this.isMuted = false;
      if (muteBtn) {
        muteBtn.classList.remove("muted");
        muteBtn.innerHTML = this._getMuteIcon(false);
        muteBtn.title = "Mute microphone";
      }

      // Clear permission state
      if (permissionState) {
        permissionState.textContent = "";
        permissionState.style.color = "";
      }

      // Update connection status
      this.updateConnectionStatus(false);
      this.toggleSoundWave(false);
    } catch (error) {
      console.error("Error stopping conversation:", error);
    }
  }


  /**
   * Get mute icon SVG
   * @private
   * @param {boolean} isMuted - Whether microphone is muted
   * @returns {string} SVG icon HTML
   */
  _getMuteIcon(isMuted) {
    const micIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M12 2C10.34 2 9 3.34 9 5V11C9 12.66 10.34 14 12 14C13.66 14 15 12.66 15 11V5C15 3.34 13.66 2 12 2Z" fill="currentColor"/>
        <path d="M19 11C19 15.41 15.41 19 11 19V21H13V23H11H9V21H11V19C6.59 19 3 15.41 3 11H5C5 14.31 7.69 17 11 17H13C16.31 17 19 14.31 19 11H19Z" fill="currentColor"/>
      </svg>`;

    const mutedIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M12 2C10.34 2 9 3.34 9 5V11C9 12.66 10.34 14 12 14C13.66 14 15 12.66 15 11V5C15 3.34 13.66 2 12 2Z" fill="currentColor"/>
        <path d="M19 11C19 15.41 15.41 19 11 19V21H13V23H11H9V21H11V19C6.59 19 3 15.41 3 11H5C5 14.31 7.69 17 11 17H13C16.31 17 19 14.31 19 11H19Z" fill="currentColor"/>
        <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`;

    return isMuted ? mutedIcon : micIcon;
  }
}

// Register the custom element
customElements.define("voice-chat-component", VoiceChatComponent);
