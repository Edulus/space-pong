// layout.js
export class Layout {
  constructor() {
    this.buttonEmojis = ["👽", "🥚", "✨", "🌀", "🔊"];
    this.buttons = document.querySelectorAll(".button");
    this.init();
  }

  init() {
    if (this.buttons.length !== this.buttonEmojis.length) {
      console.warn(
        `Layout: button count (${this.buttons.length}) does not match emoji count (${this.buttonEmojis.length}).`
      );
    }
    this.initializeButtons();
  }

  initializeButtons() {
    this.buttons.forEach((button, index) => {
      const emoji = this.buttonEmojis[index];
      if (emoji) button.textContent = emoji;
    });
  }

  getButtons() {
    return Array.from(this.buttons);
  }

  getButtonEmojis() {
    return [...this.buttonEmojis];
  }
}
