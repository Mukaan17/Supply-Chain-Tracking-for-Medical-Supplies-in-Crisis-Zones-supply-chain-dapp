/**
 * WebSocket Service
 * 
 * Provides WebSocket connection for real-time updates.
 */

import config from '../config';
import logger from '../services/logging';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.url = config.services.websocket.url;
    this.enabled = config.features.websocket && this.url;
    this.reconnectDelay = config.services.websocket.reconnectDelay;
    this.heartbeatInterval = config.services.websocket.heartbeatInterval;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.listeners = new Map();
    this.isConnected = false;
    this.shouldReconnect = true;
  }

  /**
   * Connect to WebSocket
   */
  connect() {
    if (!this.enabled || !this.url) {
      logger.debug('WebSocket disabled or URL not configured');
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      logger.debug('WebSocket already connected');
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        logger.info('WebSocket connected', { url: this.url });
        this.isConnected = true;
        this.startHeartbeat();
        this.emit('connect');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          logger.error('Failed to parse WebSocket message', error);
        }
      };

      this.ws.onerror = (error) => {
        logger.error('WebSocket error', error);
        this.emit('error', error);
      };

      this.ws.onclose = () => {
        logger.warn('WebSocket disconnected');
        this.isConnected = false;
        this.stopHeartbeat();
        this.emit('disconnect');

        // Attempt to reconnect
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      logger.error('Failed to create WebSocket connection', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    this.shouldReconnect = false;
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    logger.info('WebSocket disconnected');
  }

  /**
   * Send message
   */
  send(type, data = {}) {
    if (!this.isConnected || !this.ws) {
      logger.warn('WebSocket not connected, cannot send message');
      return false;
    }

    try {
      const message = JSON.stringify({ type, data, timestamp: Date.now() });
      this.ws.send(message);
      logger.debug('WebSocket message sent', { type });
      return true;
    } catch (error) {
      logger.error('Failed to send WebSocket message', error);
      return false;
    }
  }

  /**
   * Subscribe to event
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Unsubscribe from event
   */
  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Handle incoming message
   */
  handleMessage(data) {
    const { type, data: messageData } = data;

    logger.debug('WebSocket message received', { type });

    // Emit to listeners
    this.emit(type, messageData);

    // Handle specific message types
    switch (type) {
      case 'package_created':
      case 'package_transferred':
      case 'package_delivered':
        this.emit('package_update', { type, data: messageData });
        break;
      case 'ping':
        this.send('pong');
        break;
      default:
        break;
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data = null) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error('WebSocket listener error', error);
        }
      });
    }
  }

  /**
   * Start heartbeat
   */
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send('ping');
      }
    }, this.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Schedule reconnection
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldReconnect) {
        logger.info('Attempting to reconnect WebSocket');
        this.connect();
      }
    }, this.reconnectDelay);
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      enabled: this.enabled,
      url: this.url,
    };
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

// Auto-connect if enabled
if (typeof window !== 'undefined' && websocketService.enabled) {
  websocketService.connect();
}

export default websocketService;

