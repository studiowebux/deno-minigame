// deno serve -A --watch server.ts
import { Hono, Context } from "jsr:@hono/hono@^4.6.3";
import {
  upgradeWebSocket,
  getConnInfo,
  serveStatic,
} from "jsr:@hono/hono@^4.6.3/deno";

type TargetZone = {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  color: string;
};

const app = new Hono();

// GAME Parameters
// Define constants
const CANVAS_WIDTH = 200;
const CANVAS_HEIGHT = 200;
const OBJECT_SIZE = 20;
const BOX_MARGIN = 50;
const MAX_ZONES = 3;
const SCORE = 5;
const MINUS_SCORE = 10;
const LIFE_EFFECT = 1;
const MAX_SCORE = 10;
const MIN_SCORE = 3;
const PERFECT_HIT_BONUS = 5;

// GAME Functions
function getRandomColor(): string {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

function generateRandomZones() {
  let targetZones: TargetZone[] = [];

  const boxSizes = [60, 80, 100];

  const numZones = Math.min(
    MAX_ZONES,
    Math.floor(Math.random() * MAX_ZONES) + 1,
  );

  for (let i = 0; i < numZones; i++) {
    const boxWidth = boxSizes[Math.floor(Math.random() * boxSizes.length)];
    const boxHeight = 20;
    let boxX: number, boxY: number;
    let overlapping: boolean;
    let attempts = 0;

    do {
      boxX =
        Math.floor(Math.random() * (CANVAS_WIDTH - boxWidth - 2 * BOX_MARGIN)) +
        BOX_MARGIN;
      boxY =
        Math.floor(
          Math.random() * (CANVAS_HEIGHT - boxHeight - 2 * BOX_MARGIN),
        ) + BOX_MARGIN;

      overlapping = targetZones.some(
        (zone) =>
          boxX < zone.x + zone.width &&
          boxX + boxWidth > zone.x &&
          boxY < zone.y + zone.height &&
          boxY + boxHeight > zone.y,
      );

      attempts++;
      if (attempts > 50) {
        console.warn(
          "Exceeded maximum attempts to place zone without overlap.",
        );
        break;
      }
    } while (overlapping);

    if (!overlapping) {
      const color = getRandomColor();
      const scoreValue = Math.floor(
        Math.random() * (MAX_SCORE - MIN_SCORE) + MIN_SCORE,
      );

      targetZones.push({
        x: boxX,
        y: boxY,
        width: boxWidth,
        height: boxHeight,
        score: scoreValue,
        color: color,
      });
    }
  }

  return targetZones;
}

function sendMessage(ws: WebSocket, eventName: string, data: object) {
  ws.send(
    JSON.stringify({
      event: eventName,
      data,
    }),
  );
}

function update(
  gameRunning: boolean,
  objectY: number,
  objectDirection: number,
  objectSpeed: number,
) {
  if (gameRunning === false) return;

  objectY += objectDirection * objectSpeed;

  if (objectY <= 0 || objectY + OBJECT_SIZE >= CANVAS_HEIGHT) {
    objectDirection *= -1;
  }

  return {
    objectY,
    objectDirection,
  };
}

// SERVER definition
app.use("/*", serveStatic({ root: "./public/" }));

app.get(
  "/ws",
  upgradeWebSocket((c: Context) => {
    const info = getConnInfo(c);
    console.log(info);
    // Variables for the object position
    let objectX = CANVAS_WIDTH / 2 - OBJECT_SIZE / 2;
    let objectY = CANVAS_HEIGHT / 2 - OBJECT_SIZE / 2;
    let objectDirection = 1;
    let objectSpeed = 2;

    // Array to hold target zones
    let targetZones = generateRandomZones();
    let gameRunning = false;
    let life = MINUS_SCORE;
    let click_registered = 0;
    let perfect_hits = 0;
    let totalScore = 0;
    let game: NodeJS.Timeout;

    return {
      onOpen(_event: { data: string; event: string }, ws: WebSocket) {
        console.log("New client connected", ws);

        sendMessage(ws, "initialData", {
          objectX,
          objectY,
          objectSize: OBJECT_SIZE,
          score: totalScore,
          bonus: -1,
          life,
          targetZones,
        });

        gameRunning = true;
        game = setInterval(() => {
          const newData = update(
            gameRunning,
            objectY,
            objectDirection,
            objectSpeed,
          );
          if (!newData) return;

          objectY = newData.objectY;
          objectDirection = newData.objectDirection;

          sendMessage(ws, "objectUpdate", {
            objectX,
            objectY,
            objectSize: OBJECT_SIZE,
            score: totalScore,
            bonus: -1,
            life,
            targetZones,
          });
        }, 1000 / 60); // 60 FPS
      },
      onMessage(event: { data: string; event: string }, ws: WebSocket) {
        const data = JSON.parse(event.data);
        switch (data.event) {
          case "keyPress":
            if (gameRunning === false) return;
            let scoreChanged = false;

            click_registered += 1;
            const objectCenterY = objectY + OBJECT_SIZE / 2;

            targetZones.forEach((zone) => {
              if (
                objectCenterY >= zone.y &&
                objectCenterY <= zone.y + zone.height
              ) {
                if (objectCenterY === zone.y + zone.height / 2) {
                  totalScore += zone.score * PERFECT_HIT_BONUS;
                  perfect_hits += 1;
                } else {
                  totalScore += zone.score;
                }

                scoreChanged = true;
              }
            });

            if (!scoreChanged) {
              totalScore -= MINUS_SCORE;
              life -= LIFE_EFFECT;
            } else {
              totalScore += SCORE;
            }

            if (life === 0) {
              clearInterval(game);
              gameRunning = false;
              const bonus = totalScore / click_registered;
              console.debug("Game stopped");
              sendMessage(ws, "gameEnd", { score: totalScore, bonus });
              return;
            }

            if (click_registered >= 10) {
              if (click_registered % 10 === 0) {
                console.debug("Regenerate zone every 10 clicks");
                targetZones = generateRandomZones();
              }
              if (click_registered % 20 === 0) {
                console.debug("inverse the object direction every 20 clicks");
                objectDirection = -objectDirection;
              }
              if (click_registered % 50 === 0) {
                console.debug("increase speed every 50 clicks");
                objectSpeed += 0.3;
              }
            }

            sendMessage(ws, "scoreUpdate", {
              objectX,
              objectY,
              objectSize: OBJECT_SIZE,
              score: totalScore,
              bonus: -1,
              life,
              targetZones,
            });
            break;
        }
      },
      onClose: () => {
        console.debug("Connection closed");
        clearInterval(game);
      },
    };
  }),
);

export default app;
