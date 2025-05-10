import * as THREE from "https://esm.sh/three@0.171.0";
import { COLORS, SIZES } from "./constants.js";

export class TrafficControl {
  constructor(type, position) {
    this.type = type; // 'TrafficLight' or 'StopSign'
    this.position = position.clone();
    this.state = "green"; // For TrafficLight: 'red', 'yellow', 'green'
    this.cycleTimer = Math.random() * SIZES.TRAFFIC_LIGHT_CYCLE; // Random initial offset
    this.mesh = this.createMesh();
    this.mesh.position.copy(this.position);
  }

  createMesh() {
    const group = new THREE.Group();
    const poleGeo = new THREE.CylinderGeometry(0.2, 0.2, 1, 8); // Pole base for signs/lights

    if (this.type === "TrafficLight") {
      const poleMat = new THREE.MeshStandardMaterial({
        color: COLORS.POLE_GRAY,
      });
      const poleMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, SIZES.TRAFFIC_LIGHT_HEIGHT, 8),
        poleMat
      );
      poleMesh.position.y = 0; // Base at position y=0
      group.add(poleMesh);

      const housingGeo = new THREE.BoxGeometry(0.5, 1.5, 0.5);
      const housingMat = new THREE.MeshStandardMaterial({
        color: COLORS.LIGHT_HOUSING,
      });
      const housingMesh = new THREE.Mesh(housingGeo, housingMat);
      housingMesh.position.y = SIZES.TRAFFIC_LIGHT_HEIGHT / 2 - 0.75; // Center the housing vertically
      group.add(housingMesh);

      // Lights (Spheres) - store references to change color
      this.lights = {};
      const lightGeo = new THREE.SphereGeometry(0.2, 16, 8);
      this.lights.red = new THREE.Mesh(
        lightGeo,
        new THREE.MeshBasicMaterial({ color: COLORS.LIGHT_OFF })
      );
      this.lights.yellow = new THREE.Mesh(
        lightGeo,
        new THREE.MeshBasicMaterial({ color: COLORS.LIGHT_OFF })
      );
      this.lights.green = new THREE.Mesh(
        lightGeo,
        new THREE.MeshBasicMaterial({ color: COLORS.LIGHT_OFF })
      );

      this.lights.red.position.set(0, housingMesh.position.y + 0.5, 0.3);
      this.lights.yellow.position.set(0, housingMesh.position.y, 0.3);
      this.lights.green.position.set(0, housingMesh.position.y - 0.5, 0.3);

      group.add(this.lights.red);
      group.add(this.lights.yellow);
      group.add(this.lights.green);
      this.updateLightVisuals(); // Set initial light color
    } else if (this.type === "StopSign") {
      const poleMat = new THREE.MeshStandardMaterial({
        color: COLORS.POLE_GRAY,
      });
      const poleMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, SIZES.SIGN_HEIGHT, 8),
        poleMat
      );
      poleMesh.position.y = 0; // Base at position y=0
      group.add(poleMesh);

      const signShape = new THREE.Shape();
      const size = SIZES.SIGN_SIZE;
      const sides = 8;
      for (let i = 0; i <= sides; i++) {
        const angle = (i / sides) * Math.PI * 2 + Math.PI / sides; // Rotate to have flat top
        signShape.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
      }
      const signGeo = new THREE.ShapeGeometry(signShape);
      const signMat = new THREE.MeshBasicMaterial({
        color: COLORS.SIGN_RED,
        side: THREE.DoubleSide,
      });
      const signMesh = new THREE.Mesh(signGeo, signMat);
      signMesh.position.y = SIZES.SIGN_HEIGHT / 2 - size / 2; // Position sign face
      signMesh.rotation.z = Math.PI; // Orient text (if added later)
      // Rotate sign face towards intersection center (assuming placement on corner)
      const lookAtPos = new THREE.Vector3(0, signMesh.position.y, 0);
      signMesh.lookAt(lookAtPos);
      signMesh.rotation.y += Math.PI; // Make front face outward

      group.add(signMesh);
      // Add simple white border
      const edges = new THREE.EdgesGeometry(signGeo);
      const border = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 })
      );
      border.position.copy(signMesh.position);
      border.rotation.copy(signMesh.rotation);
      group.add(border);
    }

    return group;
  }

  update(deltaTime) {
    if (this.type === "TrafficLight") {
      this.cycleTimer += deltaTime;
      const cyclePos = this.cycleTimer % SIZES.TRAFFIC_LIGHT_CYCLE;
      let newState = this.state;

      // Simple cycle: Green -> Yellow -> Red -> Green
      const greenDuration = SIZES.TRAFFIC_LIGHT_CYCLE * 0.45;
      const yellowDuration = SIZES.TRAFFIC_LIGHT_CYCLE * 0.1;
      // Red duration is the remainder

      if (cyclePos < greenDuration) {
        newState = "green";
      } else if (cyclePos < greenDuration + yellowDuration) {
        newState = "yellow";
      } else {
        newState = "red";
      }

      if (newState !== this.state) {
        this.state = newState;
        console.log(`Traffic light changed to ${this.state}`);
        this.updateLightVisuals();
      }
    }
    // Stop signs don't change state
  }

  updateLightVisuals() {
    if (this.type !== "TrafficLight") return;

    this.lights.red.material.color.set(
      this.state === "red" ? COLORS.LIGHT_RED_ON : COLORS.LIGHT_OFF
    );
    this.lights.yellow.material.color.set(
      this.state === "yellow" ? COLORS.LIGHT_YELLOW_ON : COLORS.LIGHT_OFF
    );
    this.lights.green.material.color.set(
      this.state === "green" ? COLORS.LIGHT_GREEN_ON : COLORS.LIGHT_OFF
    );

    this.lights.red.material.needsUpdate = true;
    this.lights.yellow.material.needsUpdate = true;
    this.lights.green.material.needsUpdate = true;
  }

  reset() {
    if (this.type === "TrafficLight") {
      this.cycleTimer = Math.random() * SIZES.TRAFFIC_LIGHT_CYCLE; // Reset timer with offset
      // Recalculate initial state based on new timer
      this.update(0); // Update state based on reset timer
      this.updateLightVisuals();
    }
    // Stop signs have no state to reset intrinsically
  }

  dispose() {
    // Cleanup materials and geometries if necessary
    // (For simple shared geometries/materials, this might not be needed)
  }
}
