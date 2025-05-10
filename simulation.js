import { SPEEDS } from "./constants.js";

export class Simulation {
  constructor(objectManager) {
    this.objectManager = objectManager;
    this.state = "stopped"; // 'running', 'paused', 'stopped'
  }

  play() {
    if (this.state === "running") return;
    this.state = "running";
    console.log("Simulation Playing");
    // If previously paused, vehicles continue. If stopped, they start moving.
    this.objectManager.getVehicles().forEach((vehicle) => {
      if (vehicle.state === "idle") {
        vehicle.state = "moving";
      }
    });
  }

  pause() {
    if (this.state !== "running") return;
    this.state = "paused";
    console.log("Simulation Paused");
  }

  reset() {
    this.state = "stopped";
    console.log("Simulation Reset");
    // Reset all objects to their initial states
    this.objectManager.getObjects().forEach((obj) => {
      if (obj.instance.reset) {
        obj.instance.reset();
      }
    });
    // Optionally clear all placed objects? For now, just reset state.
    // this.objectManager.removeAllObjects();
  }

  update(deltaTime) {
    if (this.state !== "running") return;
    const vehicles = this.objectManager.getVehicles();
    const trafficControls = this.objectManager.getTrafficControls();
    // Update Traffic Controls first (lights changing)
    trafficControls.forEach((control) => {
      if (control.update) {
        control.update(deltaTime);
      }
    });
    // Create a combined array that includes both traffic controls and vehicles
    // This allows vehicles to consider other vehicles when making decisions
    const allObjects = [
      ...trafficControls,
      ...vehicles.map((vehicle) => ({ type: "Vehicle", instance: vehicle })),
    ];
    // Update Vehicles
    vehicles.forEach((vehicle) => {
      // Provide vehicles with info about relevant traffic controls AND other vehicles
      vehicle.update(deltaTime, allObjects);
    });
  }
}
