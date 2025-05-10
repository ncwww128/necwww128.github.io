import * as THREE from "https://esm.sh/three@0.171.0";
import { Game } from "./game.js";
import { UI } from "./ui.js";
import { PlacementController } from "./placementController.js";
import { Simulation } from "./simulation.js";
import { Crossroad } from "./crossroad.js";
import { ObjectManager } from "./objectManager.js";

// --- Target Element ---
const renderDiv = document.getElementById("renderDiv");
if (!renderDiv) throw new Error("Missing 'renderDiv' element");

// --- Basic Styling ---
document.body.style.margin = "0";
document.body.style.overflow = "hidden";
renderDiv.style.width = "100vw";
renderDiv.style.height = "calc(100vh - 80px)"; // Adjust height for UI panel

// --- Setup ---
const game = new Game(renderDiv);
const objectManager = new ObjectManager(game.scene);
const crossroad = new Crossroad(game.scene);
const simulation = new Simulation(objectManager);
const placementController = new PlacementController(
  game.camera,
  game.scene,
  crossroad.getPlacementZones(),
  objectManager
);
const ui = new UI(document.body, placementController, simulation); // Append UI to body
ui.setObjectManager(objectManager); // Provide objectManager to UI for path toggle and clear all
// --- Game Loop ---
let lastTime = 0;
function animate(time) {
  requestAnimationFrame(animate);
  const deltaTime = (time - lastTime) * 0.001; // Delta time in seconds

  placementController.update(); // Update raycaster
  simulation.update(deltaTime); // Update simulation state
  game.render();

  lastTime = time;
}

// --- Start ---
crossroad.create();
ui.createUI();
placementController.enable();
animate(0); // Start the loop
