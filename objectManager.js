import * as THREE from "https://esm.sh/three@0.171.0";
import { Vehicle } from "./vehicle.js";
import { TrafficControl } from "./trafficControl.js";
import { PathVisualizer } from "./pathVisualizer.js";
import { COLORS, SIZES } from "./constants.js";

export class ObjectManager {
  constructor(scene) {
    this.scene = scene;
    this.objects = []; // Stores all placed objects { id, type, instance, mesh }
    this.objectIdCounter = 0;
    this.pathVisualizer = new PathVisualizer(scene);
  }

  createObject(type, position, options = {}) {
    const id = this.objectIdCounter++;
    let instance = null;
    let mesh = null;

    switch (type) {
      case "Car":
        const carColor =
          COLORS.CAR_COLORS[
            Math.floor(Math.random() * COLORS.CAR_COLORS.length)
          ];
        // Use the detailed options provided for cars
        if (
          !options.startPosition ||
          !options.startDirection ||
          !options.goalPosition
        ) {
          console.error("Missing required options for Car creation:", options);
          return null;
        }
        // Note: The third argument (pathType) is no longer used directly here,
        // the Vehicle will calculate its path based on start/goal.
        instance = new Vehicle(
          options.startPosition,
          options.startDirection,
          options.goalPosition,
          carColor
        );
        mesh = instance.mesh;
        break;
      case "TrafficLight":
        // Position slightly higher
        const lightPos = position.clone().setY(SIZES.TRAFFIC_LIGHT_HEIGHT / 2);
        instance = new TrafficControl("TrafficLight", lightPos, options); // Pass options
        mesh = instance.mesh;
        break;
      case "StopSign":
        // Position slightly higher
        const signPos = position.clone().setY(SIZES.SIGN_HEIGHT / 2);
        instance = new TrafficControl("StopSign", signPos, options); // Pass options
        mesh = instance.mesh;
        break;
      default:
        console.warn(`Unknown object type: ${type}`);
        return null;
    }

    if (instance && mesh) {
      this.scene.add(mesh);
      const objectData = { id, type, instance, mesh };
      this.objects.push(objectData);

      // For vehicles, set up path visualization
      if (type === "Car") {
        instance.setPathVisualizer(this.pathVisualizer);
        console.log(
          `Created ${type} from`,
          options.startPosition.toArray(),
          "to",
          options.goalPosition.toArray()
        );
      } else {
        console.log(`Placed ${type} at`, position.toArray());
      }

      return objectData;
    }
    return null;
  }

  removeObject(id) {
    const index = this.objects.findIndex((obj) => obj.id === id);
    if (index !== -1) {
      const objectData = this.objects[index];
      this.scene.remove(objectData.mesh);
      if (objectData.instance.dispose) {
        // Cleanup if necessary
        objectData.instance.dispose();
      }
      this.objects.splice(index, 1);
    }
  }

  removeAllObjects() {
    // Iterate backwards because removing elements modifies the array
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const objectData = this.objects[i];
      this.scene.remove(objectData.mesh);
      if (objectData.instance.dispose) objectData.instance.dispose();
    }
    this.objects = []; // Clear the array
    this.objectIdCounter = 0; // Reset counter if needed

    // Clear all path visualizations
    if (this.pathVisualizer) {
      this.pathVisualizer.clearAllPaths();
    }
  }

  getObjects() {
    return this.objects;
  }

  getVehicles() {
    return this.objects
      .filter((obj) => obj.type === "Car")
      .map((obj) => obj.instance);
  }

  getTrafficControls() {
    return this.objects
      .filter((obj) => obj.type === "TrafficLight" || obj.type === "StopSign")
      .map((obj) => obj.instance);
  }

  // Toggle visibility of all path visualizations
  togglePathVisibility(visible) {
    this.objects.forEach((obj) => {
      if (obj.type === "Car") {
        if (visible) {
          obj.instance.setPathVisualizer(this.pathVisualizer);
        } else if (this.pathVisualizer) {
          this.pathVisualizer.clearPath(obj.instance);
        }
      }
    });
  }
}
