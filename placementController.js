import * as THREE from "https://esm.sh/three@0.171.0";
import { COLORS } from "./constants.js";
export class PlacementController {
  constructor(camera, scene, placementZones, objectManager) {
    this.camera = camera;
    this.scene = scene;
    this.placementZones = placementZones;
    this.objectManager = objectManager;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.isEnabled = false;
    this.selectedObjectType = null; // 'Car', 'TrafficLight', 'StopSign'
    // Remove selectedPathType, path is now dynamic
    this.hoveredZone = null;
    this.placementState = "idle"; // 'idle', 'awaitingCarStartPlacement', 'awaitingCarGoalPlacement'
    this.carStartData = null; // Stores { position, direction, startZone }
    this.boundOnMouseMove = this.onMouseMove.bind(this);
    this.boundOnClick = this.onClick.bind(this);
  }

  enable() {
    if (this.isEnabled) return;
    this.isEnabled = true;
    this.toggleZoneVisibility(true);
    window.addEventListener("mousemove", this.boundOnMouseMove);
    window.addEventListener("click", this.boundOnClick);
    console.log("Placement Controller Enabled");
  }

  disable() {
    if (!this.isEnabled) return;
    this.isEnabled = false;
    this.toggleZoneVisibility(false);
    this.resetHover();
    window.removeEventListener("mousemove", this.boundOnMouseMove);
    window.removeEventListener("click", this.boundOnClick);
    this.selectedObjectType = null; // Clear selection when disabled
    console.log("Placement Controller Disabled");
  }

  setSelectedObjectType(type) {
    this.selectedObjectType = type;
    console.log(`Selected object type: ${type}`);
    // Reset placement state when selecting a new type
    this.placementState = type === "Car" ? "awaitingCarStartPlacement" : "idle";
    this.carStartData = null;
    console.log(`Placement state: ${this.placementState}`);
    // Remove the promptForPathType logic
  }
  // Removed promptForPathType()
  onMouseMove(event) {
    if (!this.isEnabled) return;

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    // Adjust Y based on renderDiv positioning if it doesn't fill the window vertically
    const renderDivBounds = document
      .getElementById("renderDiv")
      .getBoundingClientRect();
    this.mouse.y =
      -((event.clientY - renderDivBounds.top) / renderDivBounds.height) * 2 + 1;

    this.updateHover();
  }

  update() {
    if (!this.isEnabled || !this.raycaster) return; // Check if raycaster exists
    // Raycaster update moved to updateHover, called from onMouseMove
  }

  updateHover() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const zoneMeshes = this.placementZones.map((z) => z.mesh);
    const intersects = this.raycaster.intersectObjects(zoneMeshes);

    let foundZone = null;
    if (intersects.length > 0) {
      const intersectedMesh = intersects[0].object;
      foundZone = this.placementZones.find((z) => z.mesh === intersectedMesh);
    }

    if (this.hoveredZone !== foundZone) {
      this.resetHover(); // Clear previous hover effect
      if (foundZone) {
        this.hoveredZone = foundZone;
        // Simple hover effect: change color slightly, respecting current placement state for cars
        let canInteract = true;
        if (this.selectedObjectType === "Car") {
          if (
            this.placementState === "awaitingCarStartPlacement" &&
            foundZone.type !== "lane_start_zone"
          ) {
            canInteract = false;
          } else if (
            this.placementState === "awaitingCarGoalPlacement" &&
            (foundZone.type !== "lane_goal_zone" ||
              foundZone === this.carStartData?.startZone)
          ) {
            canInteract = false;
          }
        } else if (
          (this.selectedObjectType && foundZone.type === "lane_start_zone") ||
          foundZone.type === "lane_goal_zone"
        ) {
          // Non-cars cannot be placed on any lane zones
          canInteract = false;
        }
        if (canInteract) {
          this.hoveredZone.mesh.material.color.set(COLORS.ZONE_HOVER);
          this.hoveredZone.mesh.material.opacity = 0.6;
        } else {
          // Indicate non-interactive by a slightly different hover or no hover
          this.hoveredZone.mesh.material.color.set(COLORS.ZONE_HOVER); // Still show hover
          this.hoveredZone.mesh.material.opacity = 0.2; // But more transparent
        }
        this.hoveredZone.mesh.material.needsUpdate = true;
      }
    }
  }

  resetHover() {
    if (this.hoveredZone) {
      let originalColor;
      switch (this.hoveredZone.type) {
        case "lane_start_zone":
          originalColor = COLORS.ZONE_LANE_START;
          break;
        case "lane_goal_zone":
          originalColor = COLORS.ZONE_LANE_GOAL;
          break;
        case "corner":
          originalColor = COLORS.ZONE_CORNER;
          break;
        default:
          originalColor = 0x000000; // Should not happen
      }
      this.hoveredZone.mesh.material.color.set(originalColor);
      this.hoveredZone.mesh.material.opacity = 0.3;
      this.hoveredZone.mesh.material.needsUpdate = true;
      this.hoveredZone = null;
    }
  }
  onClick(event) {
    if (!this.isEnabled || !this.hoveredZone) return;
    const zoneType = this.hoveredZone.type;
    // --- Handle Car Placement States ---
    if (this.selectedObjectType === "Car") {
      if (this.placementState === "awaitingCarStartPlacement") {
        if (zoneType !== "lane_start_zone") {
          console.warn("Cars must start on a blue (start) lane zone.");
          return;
        }
        // First click for car: Store start data, change state
        this.carStartData = {
          position: this.hoveredZone.pos.clone(),
          direction: this.hoveredZone.dir.clone(),
          startZone: this.hoveredZone, // Store the whole zone for later comparison
        };
        this.placementState = "awaitingCarGoalPlacement";
        console.log(
          "Car start position set. Click a yellow (goal) lane zone.",
          this.carStartData
        );
        // TODO: Visually mark the selected start zone?
        return; // Wait for the second click
      } else if (this.placementState === "awaitingCarGoalPlacement") {
        if (zoneType !== "lane_goal_zone") {
          console.warn("Car goals must be set on a yellow (goal) lane zone.");
          return;
        }
        if (this.hoveredZone === this.carStartData.startZone) {
          console.warn(
            "Start and goal zones cannot be the same physical zone."
          );
          return;
        }
        // Check if goal zone is the same as any start zone (conceptually different)
        if (this.hoveredZone.type === "lane_start_zone") {
          console.warn("Goal cannot be a start zone.");
          return;
        }
        const goalPosition = this.hoveredZone.pos.clone();
        const options = {
          startPosition: this.carStartData.position,
          startDirection: this.carStartData.direction,
          goalPosition: goalPosition,
        };
        this.objectManager.createObject(
          "Car",
          this.carStartData.position,
          options
        );

        // Reset for next car placement
        this.placementState = "awaitingCarStartPlacement";
        this.carStartData = null;
        console.log("Car created. Ready for next car start placement.");
        return;
      }
    }
    // --- Handle Other Object Placements (Signs/Lights) ---
    else if (
      this.selectedObjectType === "TrafficLight" ||
      this.selectedObjectType === "StopSign"
    ) {
      if (zoneType !== "corner") {
        console.warn(
          "Signs/Lights can only be placed in green (corner) zones."
        );
        return;
      }
      const position = this.hoveredZone.pos.clone();
      this.objectManager.createObject(this.selectedObjectType, position, {});
      // Keep selected type for placing multiple signs/lights easily
    } else {
      // No object type selected, click does nothing relevant here
      console.log(
        "Click ignored, no valid object type selected or placement state active."
      );
    }
  }

  toggleZoneVisibility(visible) {
    this.placementZones.forEach((zone) => (zone.mesh.visible = visible));
    if (!visible) this.resetHover(); // Clear hover state when hiding
  }
}
