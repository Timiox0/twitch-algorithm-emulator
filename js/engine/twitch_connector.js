/**
 * Enhanced Twitch Real-Time Live IRC WebSocket Connector
 * Deeply parses IRC message tags: Badges, Bits, Subs, Raids, First-time chatters.
 */

class TwitchLiveConnector {
  constructor(onEventCallback) {
    this.ws = null;
    this.channel = '';
    this.isConnected = false;
    this.onEvent = onEventCallback || (() => {});
    
    // Rolling metrics
    this.recentMessages = []; // Timestamps
    this.uniqueChatters = new Map(); // username -> { badges: [], isDedicated: bool, lastSeen: ts }
    this.recentEvents = [];   // Sub, Raid, Bits notices
    this.windowMs = 45000;    // 45-second rolling window

    // Dedicated vs Early classification counts in current window
    this.dedicatedChatterCount = 0;
    this.earlyChatterCount = 0;
    this.totalBitsInWindow = 0;
    this.recentSubsCount = 0;
  }

  connect(channelName) {
    if (!channelName) return;
    this.disconnect();

    this.channel = channelName.toLowerCase().replace('#', '').trim();
    const wsUrl = 'wss://irc-ws.chat.twitch.tv:443';

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        const randomNick = `justinfan${Math.floor(10000 + Math.random() * 90000)}`;
        this.ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');
        this.ws.send(`PASS SCHMOOPIIE`);
        this.ws.send(`NICK ${randomNick}`);
        this.ws.send(`JOIN #${this.channel}`);

        this.isConnected = true;
        this.onEvent({ type: 'STATUS', status: 'CONNECTED', channel: this.channel });
      };

      this.ws.onmessage = (event) => {
        this._parseIRC(event.data);
      };

      this.ws.onerror = (err) => {
        this.onEvent({ type: 'STATUS', status: 'ERROR', error: err });
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.onEvent({ type: 'STATUS', status: 'DISCONNECTED', channel: this.channel });
      };
    } catch (e) {
      console.error('Twitch WebSocket connection error:', e);
      this.onEvent({ type: 'STATUS', status: 'ERROR', error: e.message });
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
    this.recentMessages = [];
    this.uniqueChatters.clear();
    this.recentEvents = [];
    this.dedicatedChatterCount = 0;
    this.earlyChatterCount = 0;
    this.totalBitsInWindow = 0;
    this.recentSubsCount = 0;
  }

  _parseTags(tagsString) {
    const tags = {};
    if (!tagsString) return tags;
    const rawPairs = tagsString.split(';');
    for (const pair of rawPairs) {
      const idx = pair.indexOf('=');
      if (idx !== -1) {
        tags[pair.substring(0, idx)] = pair.substring(idx + 1);
      }
    }
    return tags;
  }

  _parseIRC(rawText) {
    const lines = rawText.split('\r\n');
    const now = Date.now();

    for (const line of lines) {
      if (!line) continue;

      // Handle PING/PONG
      if (line.startsWith('PING')) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send('PONG :tmi.twitch.tv');
        }
        continue;
      }

      // Check for IRC tags (starts with '@')
      let tags = {};
      let messageContent = line;

      if (line.startsWith('@')) {
        const spaceIdx = line.indexOf(' ');
        const tagsPart = line.substring(1, spaceIdx);
        tags = this._parseTags(tagsPart);
        messageContent = line.substring(spaceIdx + 1);
      }

      // 1. PRIVMSG (Chat message)
      if (messageContent.includes('PRIVMSG')) {
        const match = messageContent.match(/:(\w+)!\w+@\w+\.tmi\.twitch\.tv PRIVMSG #\w+ :(.+)/);
        const user = match ? match[1] : (tags['display-name'] || 'anon');
        const text = match ? match[2] : '';

        // Badges analysis (subscriber, founder, vip, moderator)
        const badgesStr = tags['badges'] || '';
        const isDedicated = badgesStr.includes('subscriber') || 
                            badgesStr.includes('founder') || 
                            badgesStr.includes('vip') || 
                            badgesStr.includes('moderator') ||
                            badgesStr.includes('broadcaster');

        const isFirstMsg = tags['first-msg'] === '1';
        const bits = parseInt(tags['bits'] || '0', 10);

        if (bits > 0) {
          this.totalBitsInWindow += bits;
        }

        // Store chatter
        this.uniqueChatters.set(user, {
          badges: badgesStr,
          isDedicated,
          lastSeen: now,
          isFirstMsg
        });

        this.recentMessages.push(now);

        const isQuestion = text.includes('?');
        const isHype = text.includes('!') || (text === text.toUpperCase() && text.length > 5);

        this.onEvent({
          type: 'CHAT_MESSAGE',
          user,
          text,
          isDedicated,
          isFirstMsg,
          bits,
          isQuestion,
          isHype,
          timestamp: now
        });
      }

      // 2. USERNOTICE (Subscriptions, Raids, Rituals)
      if (messageContent.includes('USERNOTICE')) {
        const msgId = tags['msg-id'] || '';
        let eventType = 'SPEND';

        if (msgId.includes('sub') || msgId.includes('resub') || msgId.includes('subgift')) {
          eventType = 'SUBSCRIPTION';
          this.recentSubsCount += 1;
        } else if (msgId.includes('raid')) {
          eventType = 'RAID';
        } else if (msgId.includes('ritual')) {
          eventType = 'FIRST_CHATTER_WELCOME';
        }

        this.recentEvents.push({ type: eventType, tags, timestamp: now });
        this.onEvent({
          type: 'SPECIAL_EVENT',
          subType: eventType,
          tags,
          timestamp: now
        });
      }
    }

    this._cleanOldEntries();
  }

  _cleanOldEntries() {
    const cutoff = Date.now() - this.windowMs;
    this.recentMessages = this.recentMessages.filter(t => t > cutoff);
    this.recentEvents = this.recentEvents.filter(e => e.timestamp > cutoff);

    // Clean inactive chatters
    for (const [user, data] of this.uniqueChatters.entries()) {
      if (data.lastSeen < cutoff) {
        this.uniqueChatters.delete(user);
      }
    }

    // Recompute Dedicated vs Early ratio
    let ded = 0;
    let early = 0;
    for (const data of this.uniqueChatters.values()) {
      if (data.isDedicated) ded++;
      else early++;
    }
    this.dedicatedChatterCount = ded;
    this.earlyChatterCount = early;
  }

  /**
   * Returns current rolling real-time metrics
   */
  getMetrics() {
    this._cleanOldEntries();
    const msgCount = this.recentMessages.length;
    const msgPerSec = parseFloat((msgCount / (this.windowMs / 1000)).toFixed(1));
    const uniqueCount = this.uniqueChatters.size;

    const totalChatters = this.dedicatedChatterCount + this.earlyChatterCount;
    const dedicatedRatio = totalChatters > 0 
      ? parseFloat((this.dedicatedChatterCount / totalChatters).toFixed(2))
      : 0.50;

    return {
      connected: this.isConnected,
      channel: this.channel,
      msgCountInWindow: msgCount,
      msgPerSec,
      uniqueChatters: uniqueCount,
      dedicatedChatterCount: this.dedicatedChatterCount,
      earlyChatterCount: this.earlyChatterCount,
      dedicatedRatio,
      totalBitsInWindow: this.totalBitsInWindow,
      recentSubsCount: this.recentSubsCount,
      specialEventsCount: this.recentEvents.length
    };
  }
}

// Export for ES Module or browser window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TwitchLiveConnector;
} else {
  window.TwitchLiveConnector = TwitchLiveConnector;
}
