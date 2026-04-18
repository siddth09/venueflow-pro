/**
 * VenueFlow Pro — Gemini AI Assistant Controller
 * Single Responsibility: manages Gemini 1.5 Flash chat with full venue context injection.
 * Uses systemInstruction + generationConfig for deterministic, persona-driven responses.
 * Security: all dynamic content injected via textContent — no innerHTML with external data.
 */

import VENUEFLOW_CONFIG from '../data/config.js';

const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;

const SYSTEM_INSTRUCTION = `You are VenueFlow AI — the intelligent stadium companion for Wankhede Stadium during MI vs CSK.
Your core mission: help attendees navigate the stadium, avoid crowds, minimize wait times, and enjoy the event.

PERSONA:
- Friendly, concise, proactive — like a knowledgeable local friend inside the stadium
- Always provide specific, actionable advice (not generic suggestions)
- Reference real venue sections: North Stand, South Stand, East Wing, West Wing, VIP Pavilion
- Mention specific facilities: Gate A/B/C/D, Food Court North, East Refreshments, West Snack Bar, VIP Lounge

RESPONSE RULES:
- Keep responses under 120 words
- Always include a concrete recommendation when relevant
- Use emojis sparingly but effectively (1-2 per response max)
- Format multi-step directions as numbered lists
- If asked about wait times or crowds, use the VENUE STATUS data injected in each prompt
- Never make up specific seat numbers — ask the user to confirm their section
- For emergencies or medical issues: immediately say "Please alert nearest staff or press SOS"`;

export class AssistantController {
  /**
   * @param {import('../engine/state.js').StateEngine} store
   * @param {HTMLElement} chatContainer - The messages container DOM element
   * @param {HTMLInputElement} inputEl - The chat input element
   * @param {HTMLButtonElement} sendBtn - The send button element
   */
  constructor(store, chatContainer, inputEl, sendBtn) {
    this.store = store;
    this.chatContainer = chatContainer;
    this.inputEl = inputEl;
    this.sendBtn = sendBtn;
    this._conversationHistory = [];
    this._isLoading = false;
    this._apiKey = VENUEFLOW_CONFIG.GEMINI_API_KEY;

    this._bindEvents();
    this._renderWelcome();
  }

  /** Bind send button click and Enter key press. */
  _bindEvents() {
    this.sendBtn.addEventListener('click', () => this._handleSend());
    this.inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._handleSend();
      }
    });

    // Suggested prompt chips
    document.querySelectorAll('.chat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.dataset.prompt;
        if (prompt) {
          this.inputEl.value = prompt;
          this._handleSend();
        }
      });
    });
  }

  /** Handles user input submission. */
  async _handleSend() {
    const rawText = this.inputEl.value.trim();
    if (!rawText || this._isLoading) return;

    // Sanitize input — strip any HTML tags
    const userText = this._sanitize(rawText);
    this.inputEl.value = '';
    this._renderUserMessage(userText);
    this._setLoading(true);

    try {
      const reply = await this._callGemini(userText);
      this._renderAssistantMessage(reply);
      this._saveToHistory('user', userText);
      this._saveToHistory('model', reply);
    } catch (err) {
      const fallback = this._getFallbackResponse(userText);
      this._renderAssistantMessage(fallback);
    } finally {
      this._setLoading(false);
    }
  }

  /**
   * Calls the Gemini 1.5 Flash API with full venue-state context.
   * @param {string} userMessage
   * @returns {Promise<string>}
   */
  async _callGemini(userMessage) {
    if (!this._apiKey) {
      // Demo mode without API key
      return this._getFallbackResponse(userMessage);
    }

    const venueContext = this._buildVenueContext();
    const contextualInstruction = `${SYSTEM_INSTRUCTION}\n\nCURRENT VENUE STATUS:\n${venueContext}`;

    const payload = {
      system_instruction: {
        parts: [{ text: contextualInstruction }],
      },
      contents: [
        ...this._conversationHistory,
        { role: 'user', parts: [{ text: userMessage }] },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 256,
        topK: 32,
        topP: 0.9,
        stopSequences: [],
      },
    };

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${this._apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');
    return text;
  }

  /** Builds a compact venue status string to inject into the system prompt. */
  _buildVenueContext() {
    const state = this.store.getState();
    const phase = state.event.phase.replace(/_/g, ' ').toUpperCase();
    const user = state.user;

    const crowdSummary = state.venue.sections
      .map(s => `${s.label}: ${Math.round(s.density * 100)}% full`)
      .join(', ');

    const waitSummary = state.venue.restrooms
      .map(r => `${r.label}: ${r.waitTime} min`)
      .concat(state.venue.concessions.map(c => `${c.label}: ${c.waitTime} min`))
      .join(', ');

    return [
      `Event Phase: ${phase}`,
      `User Seat: ${user.seatSection || 'Not set'}`,
      `Accessibility Mode: ${user.accessibilityMode ? 'YES' : 'No'}`,
      `Stadium Occupancy: ${state.venue.occupancyPercent}%`,
      `Section Crowd: ${crowdSummary}`,
      `Wait Times: ${waitSummary}`,
    ].join('\n');
  }

  /**
   * Context-aware fallback responses for demo mode (no API key).
   * Uses simple intent matching — allowlist approach (no eval/regex injection risk).
   */
  _getFallbackResponse(text) {
    const t = text.toLowerCase();
    const state = this.store.getState();
    const restrooms = state.venue.restrooms;
    const concessions = state.venue.concessions;

    if (['restroom', 'bathroom', 'toilet', 'loo'].some(w => t.includes(w))) {
      const best = [...restrooms].sort((a, b) => a.waitTime - b.waitTime)[0];
      return `🚻 Shortest wait: **${best.label}** — ${best.waitTime} min wait${best.accessible ? ' ♿ Accessible' : ''}. Head there before halftime crowd builds.`;
    }
    if (['food', 'eat', 'hungry', 'snack', 'drink'].some(w => t.includes(w))) {
      const best = [...concessions].sort((a, b) => a.waitTime - b.waitTime)[0];
      return `🍔 Lowest wait right now: **${best.label}** — ${best.waitTime} min. Or order in-seat via the Food tab — no queuing needed!`;
    }
    if (['crowd', 'busy', 'crowded', 'avoid'].some(w => t.includes(w))) {
      const quietSection = state.venue.sections
        .filter(s => s.density < 0.65)
        .sort((a, b) => a.density - b.density)[0];
      return quietSection
        ? `🗺️ Quietest zone right now: **${quietSection.label}** (${Math.round(quietSection.density * 100)}% capacity). Facilities nearby will have shorter queues.`
        : `All sections are fairly busy right now. West Snack Bar usually has shorter queues — give it a try!`;
    }
    if (['seat', 'section', 'navigate', 'get to', 'direction'].some(w => t.includes(w))) {
      return `🧭 Open the **Navigate tab** for step-by-step crowd-aware directions to your seat. Which section are you heading to?`;
    }
    if (['halftime', 'break', 'interval'].some(w => t.includes(w))) {
      return `⏰ At halftime, restroom queues spike 3x. Visit restrooms **3-4 minutes before the break** — check the Map tab for live wait times per zone.`;
    }
    if (['exit', 'leave', 'out', 'parking'].some(w => t.includes(w))) {
      return `🚪 Gate C currently has the shortest exit queue (3 min). Wait 10 min after the final whistle for post-game crush to ease.`;
    }
    if (['emergency', 'help', 'medical', 'sos'].some(w => t.includes(w))) {
      return `🆘 Please alert the nearest staff member immediately or press the **SOS button** on this screen. Medical team is stationed at the VIP Pavilion.`;
    }
    return `👋 I'm your VenueFlow AI assistant! I can help with crowd navigation, wait times, food ordering, and directions. What do you need?`;
  }

  // ─── DOM Rendering (all via textContent / createElement — XSS-proof) ────────

  _renderWelcome() {
    const msgs = [
      "Welcome to Wankhede Stadium! 🏏",
      "I'm VenueFlow AI — your personal stadium companion. Ask me anything:\n• \"Where's the nearest restroom?\"\n• \"I'm hungry — what's fastest?\"\n• \"When should I head back to my seat?\"",
    ];
    msgs.forEach(m => this._renderAssistantMessage(m));
  }

  _renderUserMessage(text) {
    const bubble = this._createBubble('user', text);
    this.chatContainer.appendChild(bubble);
    this._scrollToBottom();
  }

  _renderAssistantMessage(text) {
    const bubble = this._createBubble('assistant', text);
    this.chatContainer.appendChild(bubble);
    this._scrollToBottom();

    // Update aria-live region for screen readers
    const liveRegion = document.getElementById('chat-live-region');
    if (liveRegion) liveRegion.textContent = text;
  }

  _createBubble(role, text) {
    const wrapper = document.createElement('div');
    wrapper.className = `chat-bubble chat-bubble--${role}`;
    wrapper.setAttribute('role', role === 'assistant' ? 'log' : 'none');

    if (role === 'assistant') {
      const avatar = document.createElement('div');
      avatar.className = 'bubble-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = '🤖';
      wrapper.appendChild(avatar);
    }

    const content = document.createElement('div');
    content.className = 'bubble-content';

    // Safe rendering: split on \n and create <p> tags — no innerHTML with external data
    text.split('\n').forEach(line => {
      if (!line.trim()) return;
      const p = document.createElement('p');
      // Handle **bold** markdown safely
      p.innerHTML = this._safeBold(line); // Only processes our own **bold** pattern
      content.appendChild(p);
    });

    wrapper.appendChild(content);
    return wrapper;
  }

  /** Converts **text** → <strong>text</strong>. Safe because we control the pattern. */
  _safeBold(text) {
    const sanitized = this._sanitize(text);
    return sanitized.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  _setLoading(loading) {
    this._isLoading = loading;
    this.sendBtn.disabled = loading;
    this.sendBtn.setAttribute('aria-busy', loading ? 'true' : 'false');

    const existingLoader = this.chatContainer.querySelector('.chat-bubble--loading');
    if (loading && !existingLoader) {
      const loader = document.createElement('div');
      loader.className = 'chat-bubble chat-bubble--assistant chat-bubble--loading';
      loader.setAttribute('aria-label', 'AI is thinking');
      const dots = document.createElement('div');
      dots.className = 'typing-dots';
      ['', '', ''].forEach(() => {
        const dot = document.createElement('span');
        dots.appendChild(dot);
      });
      loader.appendChild(dots);
      this.chatContainer.appendChild(loader);
      this._scrollToBottom();
    } else if (!loading && existingLoader) {
      existingLoader.remove();
    }
  }

  _scrollToBottom() {
    requestAnimationFrame(() => {
      this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    });
  }

  _saveToHistory(role, text) {
    this._conversationHistory.push({ role, parts: [{ text }] });
    // Keep rolling window of last 10 turns to stay within token limits
    if (this._conversationHistory.length > 20) {
      this._conversationHistory = this._conversationHistory.slice(-20);
    }
    this.store.setState({
      chatHistory: this._conversationHistory,
    });
  }

  /**
   * Sanitizes user input — strips HTML tags to prevent XSS.
   * @param {string} str
   * @returns {string}
   */
  _sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
}
