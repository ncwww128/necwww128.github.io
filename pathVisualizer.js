import * as THREE from "https://esm.sh/three@0.171.0";
import { COLORS } from "./constants.js";

export class PathVisualizer {
  constructor(scene) {
    this.scene = scene;
    this.pathObjects = new Map(); // Map of vehicle ID to path visualization objects
  }

  visualizePath(vehicle, pathPoints) {
    // Clean up any existing visualization for this vehicle
    this.clearPath(vehicle);

    // Create a group to hold all visualization objects for this vehicle
    const group = new THREE.Group();

    // Create curve from the path points
    const curve = new THREE.CatmullRomCurve3(pathPoints);
    const curvePoints = curve.getPoints(50); // Generate 50 points along the curve

    // Create line geometry for the path
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      opacity: 0.7,
      transparent: true,
    });
    const pathLine = new THREE.Line(lineGeometry, lineMaterial);

    // Raise the line slightly above ground to prevent z-fighting
    pathLine.position.y = 0.1;
    group.add(pathLine);

    // Add small spheres at each waypoint
    const waypointMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      opacity: 0.8,
      transparent: true,
    });

    pathPoints.forEach((point, index) => {
      // Make different sized spheres for start, waypoints, and goal
      let radius = 0.2; // Default waypoint
      let color = 0xffff00; // Default yellow

      if (index === 0) {
        radius = 0.4; // Start point
        color = 0x00ff00; // Green
      } else if (index === pathPoints.length - 1) {
        radius = 0.4; // End point
        color = 0xff0000; // Red
      }

      const sphereGeometry = new THREE.SphereGeometry(radius, 8, 8);
      const sphereMaterial = new THREE.MeshBasicMaterial({
        color: color,
        opacity: 0.8,
        transparent: true,
      });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

      // Position the sphere at the waypoint, slightly elevated
      sphere.position.copy(point);
      sphere.position.y += 0.1;

      group.add(sphere);
    });

    // Add to scene and store reference
    this.scene.add(group);
    this.pathObjects.set(vehicle.id, group);

    return group;
  }

  clearPath(vehicle) {
    if (this.pathObjects.has(vehicle.id)) {
      const group = this.pathObjects.get(vehicle.id);
      this.scene.remove(group);

      // Dispose of geometries and materials to prevent memory leaks
      group.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });

      this.pathObjects.delete(vehicle.id);
    }
  }

  clearAllPaths() {
    this.pathObjects.forEach((group, id) => {
      this.scene.remove(group);

      // Dispose resources
      group.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    });

    this.pathObjects.clear();
  }
}
