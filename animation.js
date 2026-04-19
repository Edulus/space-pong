// animation.js
export class Animation {
  constructor(layout, audio = null) {
    this.layout = layout;
    this.audio = audio;
    this.animatingButtons = new WeakSet();
    this.init();
  }

  init() {
    this.setupHoverSounds();
    this.setupClickAnimations();
  }

  _safeAudio(fn) {
    if (!this.audio) return;
    try {
      fn(this.audio);
    } catch (err) {
      console.warn("Audio call failed:", err);
    }
  }

  setupHoverSounds() {
    if (!this.audio) return;
    const buttons = this.layout.getButtons();
    buttons.forEach((button, index) => {
      button.addEventListener("mouseenter", () => {
        this._safeAudio((a) => a.playHoverChirp(index));
      });
      button.addEventListener("focus", () => {
        this._safeAudio((a) => a.playHoverChirp(index));
      });
    });
  }

  setupClickAnimations() {
    const buttons = this.layout.getButtons();
    const buttonEmojis = this.layout.getButtonEmojis();

    buttons.forEach((button, index) => {
      button.addEventListener("click", (e) => {
        // Allow modifier-clicks and middle-clicks to behave normally
        if (e.defaultPrevented) return;
        if (e.button !== 0) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

        // Guard against double-clicks re-triggering the animation
        if (this.animatingButtons.has(button)) {
          e.preventDefault();
          return;
        }

        e.preventDefault();
        this.animatingButtons.add(button);

        this._safeAudio((a) => {
          a.playClickChirp(index);
          a.playRush(0.35);
        });

        this.animateButton(button, buttonEmojis[index], button.href);
      });
    });
  }

  animateButton(button, emoji, url) {
    const animatedEmoji = document.createElement("div");
    animatedEmoji.textContent = emoji;
    animatedEmoji.setAttribute("aria-hidden", "true");
    animatedEmoji.style.position = "fixed";
    animatedEmoji.style.fontSize = "48px";
    animatedEmoji.style.zIndex = "1000";
    animatedEmoji.style.pointerEvents = "none";

    const rect = button.getBoundingClientRect();
    animatedEmoji.style.left = `${rect.left + rect.width / 2}px`;
    animatedEmoji.style.top = `${rect.top + rect.height / 2}px`;

    document.body.appendChild(animatedEmoji);

    // Respect prefers-reduced-motion: skip the animation entirely
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduceMotion) {
      animatedEmoji.remove();
      window.location.href = url;
      return;
    }

    let navigated = false;
    const go = () => {
      if (navigated) return;
      navigated = true;
      animatedEmoji.remove();
      window.location.href = url;
    };

    const animation = animatedEmoji.animate(
      [
        { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
        { transform: "translate(-50%, -50%) scale(8)", opacity: 0 },
      ],
      {
        duration: 350,
        easing: "ease-in",
      }
    );

    animation.onfinish = go;
    animation.oncancel = go;
  }
}
