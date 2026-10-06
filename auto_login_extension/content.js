(() => {
  const CREDENTIALS = {
    "aizi-chat.trade.kg": { u: "777", p: "pospod00" },
    "test-tnved.trade.kg": { u: "777", p: "pospod00" },
    "ai.trade.kg": { u: "admin", p: "S374367j" },
    "ocr.trade.kg": { u: "admin", p: "S374367j" },
    "cost-tovar.trade.kg": { u: "999", p: "pospod00" }
  };
  const host = location.hostname;
  const cred = CREDENTIALS[host];
  if (!cred) return;

  const setValue = (el, value) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    setter ? setter.call(el, value) : (el.value = value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const visible = el => !!(el && el.offsetParent !== null && getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none");
  const q = sel => [...document.querySelectorAll(sel)].filter(visible);

  function findUserInput(passwordInput) {
    const candidates = q('input[name*="user" i], input[name*="login" i], input[name*="email" i], input[id*="user" i], input[id*="login" i], input[id*="email" i], input[type="text"], input[type="email"], input:not([type])');
    const beforePassword = candidates.filter(i => passwordInput ? i.compareDocumentPosition(passwordInput) & Node.DOCUMENT_POSITION_FOLLOWING : true);
    return beforePassword[0] || candidates[0];
  }

  function clickSubmit() {
    const buttons = q('button, input[type="submit"], [role="button"]');
    const preferred = buttons.find(b => /войти|login|sign\s*in|кірүү|submit|продолжить|continue|отправить/i.test((b.innerText || b.value || b.ariaLabel || "").trim())) || buttons.find(b => b.type === "submit") || buttons[0];
    if (preferred) preferred.click();
    else {
      const form = document.querySelector('form');
      if (form) form.requestSubmit ? form.requestSubmit() : form.submit();
    }
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    const pass = q('input[type="password"]')[0];
    if (pass) {
      const user = findUserInput(pass);
      if (user) setValue(user, cred.u);
      setValue(pass, cred.p);
      setTimeout(clickSubmit, 250);
      clearInterval(timer);
      return;
    }
    if (attempts > 40) clearInterval(timer);
  }, 500);

  if (host === "aizi-chat.trade.kg") {
    const VOICE_ID = "otg-aizi-live-voice";
    let recognition = null;
    let listening = false;
    let awaitingAnswer = false;
    let lastQuestion = "";
    let lastAnswer = "";
    let mutationTimer = 0;
    let answerPoll = 0;
    let baselineTexts = new Set();
    let chatFrameSource = null;

    function findChatInput() {
      const candidates = q('textarea, [role="textbox"], [contenteditable="true"], input[type="text"], input:not([type])')
        .filter(el => !el.closest(`#${VOICE_ID}`) && !el.closest('form')?.querySelector('input[type="password"]'));
      return candidates.sort((a, b) => {
        const aHint = /сообщ|вопрос|напиш|message|ask/i.test(`${a.placeholder || ''} ${a.ariaLabel || ''}`) ? 1e7 : 0;
        const bHint = /сообщ|вопрос|напиш|message|ask/i.test(`${b.placeholder || ''} ${b.ariaLabel || ''}`) ? 1e7 : 0;
        return (bHint + b.clientWidth * b.clientHeight) - (aHint + a.clientWidth * a.clientHeight);
      })[0];
    }

    function openDialog() {
      if (findChatInput()) return;
      const dialogButton = q('button, [role="button"]').find(el => /диалог|dialog|chat/i.test((el.innerText || el.ariaLabel || "").trim()));
      if (dialogButton) dialogButton.click();
    }

    function setChatValue(input, value) {
      input.focus();
      if (input.isContentEditable) {
        input.textContent = value;
        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
      } else {
        setValue(input, value);
      }
    }

    function clickChatSend(input) {
      const root = input.closest('form') || input.parentElement?.parentElement || document;
      const buttons = [...root.querySelectorAll('button, [role="button"]')].filter(visible).filter(el => !el.disabled);
      const send = buttons.find(el => /отправ|send|submit/i.test((el.innerText || el.ariaLabel || el.title || "").trim())) || buttons.find(el => el.type === 'submit') || buttons.at(-1);
      if (send) send.click();
      else {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
      }
    }

    function status(text, mode = "idle") {
      const box = document.getElementById(VOICE_ID);
      if (!box) return;
      box.dataset.mode = mode;
      box.querySelector('[data-status]').textContent = text;
      box.querySelector('[data-mic]').setAttribute('aria-label', listening ? 'Остановить запись' : 'Задать вопрос голосом');
    }

    function bridgeMessage(message) {
      if (window.parent && window.parent !== window) window.parent.postMessage(message, '*');
      if (window.opener && !window.opener.closed) window.opener.postMessage(message, '*');
    }

    function speak(text) {
      if (!text || !("speechSynthesis" in window)) return;
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ru-RU';
      utterance.rate = .94;
      utterance.onstart = () => status('AIZI отвечает…', 'speaking');
      utterance.onend = () => status('Готова слушать', 'ready');
      speechSynthesis.speak(utterance);
    }

    function messageCandidates() {
      const selectors = '[data-message-author-role="assistant"], [data-role="assistant"], [class*="assistant" i], [class*="bot" i], [class*="message" i], [class*="answer" i], [class*="response" i], article, main p';
      return [...document.querySelectorAll(selectors)]
        .filter(visible)
        .filter(el => !el.closest(`#${VOICE_ID}`))
        .map(el => (el.innerText || '').trim())
        .filter(text => text.length > 15 && text.length < 12000 && text !== lastQuestion);
    }

    function captureAnswer() {
      if (!awaitingAnswer) return;
      const candidates = messageCandidates();
      const answer = candidates.reverse().find(text => !baselineTexts.has(text) && text !== lastAnswer && !text.includes(lastQuestion));
      if (!answer) return;
      lastAnswer = answer;
      awaitingAnswer = false;
      clearInterval(answerPoll);
      if (window.top === window && (!window.opener || window.opener.closed)) speak(answer);
      bridgeMessage({ type: 'OTG_AIZI_RESPONSE', text: answer });
    }

    function scheduleCapture() {
      if (!awaitingAnswer) return;
      clearTimeout(mutationTimer);
      mutationTimer = setTimeout(captureAnswer, 1100);
    }

    function sendToAizi(text) {
      const question = String(text || '').trim();
      if (!question) return;
      baselineTexts = new Set(messageCandidates());
      let inputAttempts = 0;
      const waitForInput = setInterval(() => {
        inputAttempts++;
        openDialog();
        const input = findChatInput();
        if (!input) {
          if (inputAttempts < 30) return;
          clearInterval(waitForInput);
          status('Не найдено поле чата AIZI', 'error');
          bridgeMessage({ type: 'OTG_AIZI_ERROR', text: 'AIZI загрузилась, но поле диалога не найдено. Нажмите LIVE и откройте раздел «Диалог».' });
          return;
        }
        clearInterval(waitForInput);
        lastQuestion = question;
        awaitingAnswer = true;
        setChatValue(input, question);
        setTimeout(() => clickChatSend(input), 120);
        status('Вопрос отправлен в AIZI…', 'waiting');
        clearInterval(answerPoll);
        answerPoll = setInterval(captureAnswer, 900);
        setTimeout(() => { if (awaitingAnswer) bridgeMessage({type:'OTG_AIZI_STATUS', text:'AIZI формирует ответ…'}); }, 9000);
      }, 500);
    }

    function startRecognition() {
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Recognition) {
        status('Откройте сайт в Google Chrome', 'error');
        return;
      }
      if (listening && recognition) {
        recognition.stop();
        return;
      }
      recognition = new Recognition();
      recognition.lang = 'ru-RU';
      recognition.interimResults = true;
      recognition.continuous = false;
      let finalText = '';
      recognition.onstart = () => { listening = true; status('Слушаю… говорите', 'listening'); };
      recognition.onresult = event => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalText += text;
          else interim += text;
        }
        status(finalText || interim || 'Слушаю…', 'listening');
        if (finalText.trim()) recognition.stop();
      };
      recognition.onerror = event => {
        listening = false;
        status(event.error === 'not-allowed' ? 'Разрешите микрофон' : 'Не расслышала — повторите', 'error');
      };
      recognition.onend = () => {
        listening = false;
        recognition = null;
        if (finalText.trim()) sendToAizi(finalText);
        else if (document.getElementById(VOICE_ID)?.dataset.mode !== 'error') status('Нажмите и задайте вопрос');
      };
      recognition.start();
    }

    function installVoicePanel() {
      if (document.getElementById(VOICE_ID)) return;
      const style = document.createElement('style');
      style.textContent = `#${VOICE_ID}{position:fixed;z-index:2147483647;right:18px;bottom:18px;display:flex;align-items:center;gap:9px;padding:8px 10px 8px 13px;border:1px solid #b8ddcf;border-radius:16px;background:rgba(255,255,255,.96);box-shadow:0 14px 38px rgba(4,55,43,.22);font:600 12px/1.2 Arial,sans-serif;color:#29463d;backdrop-filter:blur(12px)}#${VOICE_ID} button{height:42px;border:0;border-radius:12px;cursor:pointer;font:700 11px Arial,sans-serif}#${VOICE_ID} [data-mic]{width:42px;display:grid;place-items:center;background:#0e8069;color:#fff}#${VOICE_ID} [data-mic] svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2}#${VOICE_ID} [data-replay]{padding:0 10px;background:#eef6f3;color:#306257}#${VOICE_ID}[data-mode="listening"] [data-mic]{background:#e94e47;box-shadow:0 0 0 7px rgba(233,78,71,.14)}#${VOICE_ID}[data-mode="speaking"] [data-mic]{background:#245fc4}#${VOICE_ID} [data-status]{min-width:120px;max-width:260px}`;
      document.documentElement.appendChild(style);
      const panel = document.createElement('div');
      panel.id = VOICE_ID;
      panel.innerHTML = `<span data-status>Подключаем AIZI…</span><button data-replay type="button">Повторить</button><button data-mic type="button" aria-label="Задать вопрос голосом"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg></button>`;
      panel.querySelector('[data-mic]').addEventListener('click', startRecognition);
      panel.querySelector('[data-replay]').addEventListener('click', () => lastAnswer ? speak(lastAnswer) : status('Сначала задайте вопрос'));
      document.documentElement.appendChild(panel);
      status('Нажмите и задайте вопрос', 'ready');
      bridgeMessage({ type: 'OTG_AIZI_READY' });
    }

    window.addEventListener('message', event => {
      const fromParent = event.source === window.parent || event.source === window.opener;
      const fromChild = [...document.querySelectorAll('iframe')].some(frame => frame.contentWindow === event.source);
      if (fromChild && /^OTG_AIZI_(READY|RESPONSE|ERROR|STATUS)$/.test(event.data?.type || '')) {
        chatFrameSource = event.source;
        bridgeMessage(event.data);
        return;
      }
      if (fromParent && event.data?.type === 'OTG_AIZI_ASK') {
        if (chatFrameSource) chatFrameSource.postMessage(event.data, '*');
        else sendToAizi(event.data.text);
      }
    });
    new MutationObserver(scheduleCapture).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    const voiceBoot = setInterval(() => {
      if (!q('input[type="password"]')[0] && findChatInput()) {
        installVoicePanel();
        clearInterval(voiceBoot);
      }
    }, 700);
    setTimeout(() => {
      if (!document.getElementById(VOICE_ID)) bridgeMessage({type:'OTG_AIZI_STATUS', text:'AIZI загружается или выполняет вход…'});
    }, 15000);
  }
})();
