/**
 * CANVAS
 */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

/**
 * Websocket
 */
const ws = new WebSocket("ws://localhost:8000/ws");

/**
 * INTERACTIONS
 */
let spacePressed = false;

/**
 * @typedef {Object} Data
 * @property {number} objectSize
 * @property {number} objectX
 * @property {number} objectY
 * @property {number} score
 * @property {number} bonus
 * @property {number} life
 * @property {Array} targetZones
 */

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.event) {
    case "initialData":
      redrawCanvas(data.data);
      break;

    case "objectUpdate":
      redrawCanvas(data.data);
      break;

    case "scoreUpdate":
      redrawCanvas(data.data);
      break;

    case "gameEnd":
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = "black";
      ctx.font = "20px Arial";
      ctx.fillText(`Score: ${data.data.score}`, 10, 30);

      ctx.fillStyle = "black";
      ctx.font = "20px Arial";
      ctx.fillText(`Bonus: ${data.data.bonus.toFixed(1)}%`, 10, 60);
      break;
  }
};

/**
 *
 * @param {Data} data
 */
function redrawCanvas(data) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = "red";
  ctx.fillRect(data.objectX, data.objectY, data.objectSize, data.objectSize);

  data.targetZones.forEach((zone) => {
    ctx.strokeStyle = zone.color;
    ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
  });

  ctx.fillStyle = "black";
  ctx.font = "20px Arial";
  ctx.fillText(`Score: ${data.score}`, 10, 30);

  ctx.fillStyle = "black";
  ctx.font = "20px Arial";
  ctx.fillText(`Life: ${data.life}`, 10, 60);
}

function handleInput() {
  ws.send(JSON.stringify({ event: "keyPress" }));
}

canvas.addEventListener("click", handleInput);
// Debounce the key press to prevent constant triggering
window.addEventListener("keydown", function (event) {
  if (event.code === "Space" && !spacePressed) {
    handleInput();
    spacePressed = true; // Mark the spacebar as pressed
  }
});

// Reset the spacePressed variable when the key is released
window.addEventListener("keyup", function (event) {
  if (event.code === "Space") {
    spacePressed = false; // Mark the spacebar as released
  }
});
