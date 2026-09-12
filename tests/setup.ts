// Global test setup and testing-library DOM matcher registration.
import "@testing-library/jest-dom";

// Mock HTMLCanvasElement.prototype.getContext for jsdom environments lacking native canvas package
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string) {
    if (contextId === "2d") {
      return {
        canvas: this,
        clearRect: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        fillText: () => {},
        measureText: (text: string) => ({ width: text.length * 9 }),
        beginPath: () => {},
        roundRect: () => {},
        rect: () => {},
        fill: () => {},
        save: () => {},
        restore: () => {},
        font: "",
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 1,
        textAlign: "start",
        textBaseline: "alphabetic",
      } as unknown as CanvasRenderingContext2D;
    }
    return null;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
}
