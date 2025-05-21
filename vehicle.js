import * as THREE from "https://esm.sh/three@0.171.0";
import { COLORS, SIZES, SPEEDS } from "./constants.js";

export class Vehicle {
  constructor(
    startPosition,
    startDirection,
    goalPosition,
    color = COLORS.CAR_DEFAULT
  ) {
    this.id = Math.floor(Math.random() * 1000000); // Add unique ID for path visualization
    this.startPosition = startPosition.clone();
    this.position = startPosition.clone();
    this.direction = startDirection.clone().normalize(); // Initial direction
    this.goalPosition = goalPosition.clone(); // Target destination zone center
    this.speed = SPEEDS.CAR_NORMAL;
    this.state = "idle"; // 'idle', 'moving', 'stopping', 'stopped'
    this.stopTimer = 0; // Timer for stop signs/lights
    this.targetStopPosition = null; // Where the car should be when in 'stopping' or 'stopped' state at a line
    this.stoppingForControl = null; // Which control instance (light/sign) is causing a stop/stopping state.
    this.satisfiedControls = new Set(); // Tracks StopSign controls that have been fully satisfied.
    const geometry = new THREE.BoxGeometry(
      SIZES.CAR_WIDTH,
      SIZES.CAR_HEIGHT,
      SIZES.CAR_LENGTH
    );
    const material = new THREE.MeshStandardMaterial({ color: color });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    this.mesh.position.y += SIZES.CAR_HEIGHT / 2; // Sit on the ground
    this.mesh.lookAt(this.position.clone().add(this.direction)); // Initial orientation
    this.isRightTurnThroughIntersection = false; // Will be set in calculatePath
    this.isLeftTurnThroughIntersection = false; // Will be set in calculatePath
    this.path = this.calculatePath(); // Calculate target points/segments
    this.currentPathSegment = 0;
    this.targetPosition = this.path.length > 0 ? this.path[0] : this.position;
    // The path visualizer will be set externally by objectManager
    this.pathVisualizer = null;
  }

  calculatePath() {
    const pathPoints = [];
    const start = this.startPosition;
    const goal = this.goalPosition;
    const dir = this.direction;
    const halfRoadWidth = SIZES.ROAD_WIDTH / 2;
    const laneWidth = SIZES.LANE_WIDTH;
    // Determine the intended exit direction from the intersection center towards the goal zone.
    const goalExitDir = new THREE.Vector3();
    if (Math.abs(goal.x) > Math.abs(goal.z)) {
      // Goal is primarily East/West of center
      goalExitDir.set(Math.sign(goal.x), 0, 0);
    } else {
      // Goal is primarily North/South of center
      goalExitDir.set(0, 0, Math.sign(goal.z));
    }
    // Determine turn type
    const isTurning = !(
      Math.sign(dir.x) === Math.sign(goalExitDir.x) &&
      Math.sign(dir.z) === Math.sign(goalExitDir.z)
    );
    const crossProductY = dir.x * goalExitDir.z - dir.z * goalExitDir.x;
    this.isRightTurnThroughIntersection = crossProductY > 0.1;
    this.isLeftTurnThroughIntersection = crossProductY < -0.1;
    const isRightTurn = this.isRightTurnThroughIntersection; // Use instance var for consistency
    const isLeftTurn = this.isLeftTurnThroughIntersection; // Use instance var for consistency
    // Calculate intersectionEntry (P0 - start point of the curve)
    const intersectionEntry = new THREE.Vector3();
    intersectionEntry.y = start.y; // Keep y the same
    // Calculate intersectionEntry (P0 - start point of the curve/maneuver)
    // This point is where the vehicle's current lane meets the boundary of the central intersection square.
    // It is the "near edge" relative to the vehicle's approach, for ALL turn types and straight paths.
    if (Math.abs(dir.x) > 0.5) {
      // Moving along X (East/West)
      intersectionEntry.x = -Math.sign(dir.x) * halfRoadWidth; // e.g. coming from West (dir.x=1), entry is at -halfRoadWidth
      intersectionEntry.z = start.z;
    } else {
      // Moving along Z (North/South)
      intersectionEntry.z = -Math.sign(dir.z) * halfRoadWidth; // e.g. coming from South (dir.z=-1), entry is at +halfRoadWidth
      intersectionEntry.x = start.x;
    }
    pathPoints.push(intersectionEntry);
    // Calculate intersectionExit (P3 - end point of the curve inside intersection)
    const intersectionExit = new THREE.Vector3();
    intersectionExit.y = start.y;
    if (!isTurning) {
      // Going straight
      // The exit point is on the opposite side of the intersection, in the same lane.
      if (Math.abs(dir.x) > 0.5) {
        // Moving horizontally
        intersectionExit.x = Math.sign(dir.x) * halfRoadWidth; // Corrected: Exit on far side
        intersectionExit.z = start.z;
      } else {
        // Moving vertically
        intersectionExit.z = Math.sign(dir.z) * halfRoadWidth; // Corrected: Exit on far side
        intersectionExit.x = start.x;
      }
    } else if (isRightTurn) {
      // For a right turn, the exit point of the curve is at the edge of the intersection,
      // in the center of the target lane on the road the car is turning onto.
      if (Math.abs(goalExitDir.x) > 0.5) {
        // Exiting Horizontally (e.g., car was going South, turns East)
        intersectionExit.x = Math.sign(goalExitDir.x) * halfRoadWidth; // Edge of intersection in exit direction
        // The Z position is the center of the target lane on this horizontal road.
        // This depends on the Z-component of the *final goal position* to determine the correct lane.
        intersectionExit.z = Math.sign(goal.z) * (laneWidth / 2);
      } else {
        // Exiting Vertically (e.g., car was going West, turns North)
        intersectionExit.z = Math.sign(goalExitDir.z) * halfRoadWidth; // Edge of intersection in exit direction
        // The X position is the center of the target lane on this vertical road.
        intersectionExit.x = Math.sign(goal.x) * (laneWidth / 2);
      }
    } else {
      // Left Turn (or straight if thresholds not met, but !isTurning handles pure straight)
      // Left turn: Vehicle crosses the center. Exit point is in the target lane on the far side.
      if (Math.abs(goalExitDir.x) > 0.5) {
        // Exiting Horizontally (e.g. South to East)
        intersectionExit.x = Math.sign(goalExitDir.x) * halfRoadWidth; // Far X edge of intersection
        // The Z position should be the center of the target lane.
        // Example: South (dir 0,0,-1) to East (goalExitDir 1,0,0). Goal is (+X, -laneWidth/2)
        intersectionExit.z = Math.sign(goal.z) * (laneWidth / 2);
      } else {
        // Exiting Vertically (e.g. West to South)
        intersectionExit.z = Math.sign(goalExitDir.z) * halfRoadWidth; // Far Z edge of intersection
        // The X position should be the center of the target lane.
        // Example: West (dir 1,0,0) to South (goalExitDir 0,0,-1). Goal is (-laneWidth/2, -Z)
        intersectionExit.x = Math.sign(goal.x) * (laneWidth / 2);
      }
    }
    intersectionExit.y = start.y; // Keep y the same for path points

    if (!isTurning) {
      // Going straight, simple path: entry -> exit -> goal
      // intersectionEntry is already in pathPoints from line 49
      pathPoints.push(intersectionExit);
      pathPoints.push(goal);
    } else {
      // We're turning: Calculate a smooth Bezier curve
      let controlPoint1, controlPoint2;
      if (isRightTurn) {
        const P0 = intersectionEntry;
        const P3 = intersectionExit;
        let C_corner = new THREE.Vector3();
        // Determine the inner corner point (C_corner) for the right turn
        if (Math.abs(dir.z) > 0.5) {
          // Vehicle initially moving along Z-axis (North/South)
          // Turning onto an X-axis road
          C_corner.set(P0.x, P0.y, P3.z);
        } else {
          // Vehicle initially moving along X-axis (East/West)
          // Turning onto a Z-axis road
          C_corner.set(P3.x, P0.y, P0.z);
        }
        // Convert quadratic Bezier (P0, C_corner, P3) to cubic control points
        controlPoint1 = new THREE.Vector3().lerpVectors(P0, C_corner, 2 / 3);
        controlPoint2 = new THREE.Vector3().lerpVectors(P3, C_corner, 2 / 3);
      } else {
        // For Left Turns or other complex turns (currently using original logic)
        const distanceEntryToExit =
          intersectionEntry.distanceTo(intersectionExit);
        const k = distanceEntryToExit * 0.4;
        controlPoint1 = new THREE.Vector3()
          .copy(intersectionEntry)
          .addScaledVector(dir, k);

        controlPoint2 = new THREE.Vector3()
          .copy(intersectionExit)
          .addScaledVector(goalExitDir, -k);
      }
      // Generate the Bezier curve points using the helper function
      const curvePoints = this.createBezierCurve(
        intersectionEntry,
        intersectionExit,
        controlPoint1,
        controlPoint2,
        8 // Number of segments (results in 9 points for the curve part)
      );

      // Add all curve points *except the first one* (which is intersectionEntry, already in pathPoints)
      for (let i = 1; i < curvePoints.length; i++) {
        pathPoints.push(curvePoints[i]);
      }

      // Add the final goal
      pathPoints.push(goal);
    }
    console.log(
      "Calculated Path:",
      pathPoints.map((p) => p.toArray())
    );

    // Create a Bezier curve if we have a path visualizer
    if (this.pathVisualizer) {
      this.pathVisualizer.visualizePath(this, pathPoints);
    }

    return pathPoints;
  }
  // Helper function to create a Bezier curve between points
  createBezierCurve(
    startPoint,
    endPoint,
    controlPoint1,
    controlPoint2,
    numSegments = 10
  ) {
    const curve = new THREE.CubicBezierCurve3(
      startPoint,
      controlPoint1,
      controlPoint2,
      endPoint
    );
    // getPoints returns numSegments + 1 points
    return curve.getPoints(numSegments);
  }

  update(deltaTime, allObjects) {
    // Renamed trafficControls to allObjects for clarity
    // Handle 'stopping' state (timed stop, e.g., for stop signs or yielding)
    if (this.state === "stopping") {
      this.stopTimer -= deltaTime;
      if (this.stopTimer <= 0) {
        // Order of checks after stop timer elapses:
        // 1. Yield to "privileged" traffic (those not stopping for their own control).
        if (this.mustYieldToPrivilegedTraffic(allObjects)) {
          this.stopTimer = 0.3 + Math.random() * 0.2; // Short, slightly randomized yield extension
          this.targetStopPosition = this.position.clone(); // Hold current position
          // console.log(`Vehicle ${this.id} extending stop (timer: ${this.stopTimer.toFixed(1)}s) to yield to privileged traffic.`);
          return; // Remain in 'stopping' state
        }
        // 2. Yield to cars with right-of-way (e.g., at other stop signs, car on right).
        // This is relevant for multi-way stop scenarios after the initial mandatory stop.
        // This check should only apply if the car *was* stopping for a StopSign.
        if (
          this.stoppingForControl &&
          this.stoppingForControl.type === "StopSign"
        ) {
          if (this.checkForCarsWithRightOfWay(allObjects) > 0) {
            this.stopTimer = 0.3 + Math.random() * 0.2; // Short, slightly randomized yield extension
            this.targetStopPosition = this.position.clone(); // Hold current position
            console.log(
              `Vehicle ${
                this.id
              } extending stop (timer: ${this.stopTimer.toFixed(
                1
              )}s) to yield to car with right-of-way after initial stop.`
            );
            return; // Remain in 'stopping' state
          }
        }

        // If no yielding conditions met, proceed to move.
        // This is the crucial part: if both yielding checks pass (or don't apply), we move.
        this.state = "moving";
        this.targetStopPosition = null;
        if (
          this.stoppingForControl &&
          this.stoppingForControl.type === "StopSign"
        ) {
          this.satisfiedControls.add(this.stoppingForControl);
          console.log(
            `Vehicle ${this.id} satisfied StopSign (ID: ${
              this.stoppingForControl.mesh
                ? this.stoppingForControl.mesh.uuid.slice(0, 5)
                : "N/A"
            }). Total satisfied: ${
              this.satisfiedControls.size
            }. Transitioning to 'moving'.`
          );
        } else {
          console.log(
            `Vehicle ${this.id} stop timer elapsed (or light changed). All yield checks passed. Transitioning to 'moving'.`
          );
        }
        this.stoppingForControl = null; // Clear this too
      } else {
        // While timer is active, ensure car remains at its targetStopPosition
        if (this.targetStopPosition) {
          this.position.copy(this.targetStopPosition);
          this.mesh.position.copy(this.position);
          this.mesh.position.y = SIZES.CAR_HEIGHT / 2;
          if (this.direction.lengthSq() > 0.001) {
            // Maintain orientation
            this.mesh.lookAt(this.position.clone().add(this.direction));
          }
        }
        return; // Do nothing else this frame if actively stopping/waiting
      }
    }
    if (this.state === "stopped") {
      if (
        this.stoppingForControl &&
        this.stoppingForControl.type === "TrafficLight"
      ) {
        if (this.stoppingForControl.state !== "red") {
          this.state = "moving";
          this.targetStopPosition = null;
          // No need to add TrafficLights to satisfiedControls, they should be re-evaluated.
          const lightId =
            this.stoppingForControl && this.stoppingForControl.mesh
              ? this.stoppingForControl.mesh.uuid.slice(0, 5)
              : "N/A";
          this.stoppingForControl = null;
          console.log(
            `Vehicle ${this.id} resuming from RED LIGHT (ID: ${lightId}) as it's no longer red.`
          );
        } else {
          // Still red, ensure car remains at its targetStopPosition
          if (this.targetStopPosition) {
            this.position.copy(this.targetStopPosition);
            this.mesh.position.copy(this.position);
            this.mesh.position.y = SIZES.CAR_HEIGHT / 2;
            if (this.direction.lengthSq() > 0.001) {
              this.mesh.lookAt(this.position.clone().add(this.direction));
            }
          }
          return; // Do nothing else this frame if actively stopped for specific red light
        }
      } else {
        // If 'stopped' but not for a known traffic light (should not happen ideally for 'stopped' state)
        // or if stoppingForControl became null unexpectedly.
        console.warn(
          `Vehicle ${this.id} in 'stopped' state without valid TrafficLight control. Attempting to move.`
        );
        this.state = "moving";
        this.targetStopPosition = null;
        // this.recentlySatisfiedControl is not set here as there was no specific control being waited for.
        this.stoppingForControl = null;
      }
    }
    // --- Traffic Control and Yielding Checks for MOVING vehicles ---
    if (this.state === "moving") {
      const checkDistanceToControls = SIZES.ROAD_WIDTH * 1.5; // Increased slightly for better detection from corners
      const stopSafetyMargin = 0.05;
      // Common logic for determining designated stop position for any upcoming intersection control
      const intersectionBoundaryPoint =
        this.path.length > 0 ? this.path[0] : this.position.clone();
      const stopOffsetDistance = SIZES.CAR_LENGTH / 2 + stopSafetyMargin;
      const designatedCarCenterStopPosition = intersectionBoundaryPoint
        .clone()
        .sub(this.direction.clone().multiplyScalar(stopOffsetDistance));
      const potentialMoveDistance = this.speed * deltaTime;
      const vectorToDesignatedStopPoint = designatedCarCenterStopPosition
        .clone()
        .sub(this.position);
      const signedDistanceToDesignatedStopPoint =
        vectorToDesignatedStopPoint.dot(this.direction);
      // Check if car is approaching its designated stopping point for *any* potential control
      const isApproachingDesignatedStopPoint =
        signedDistanceToDesignatedStopPoint <=
          potentialMoveDistance + stopSafetyMargin &&
        signedDistanceToDesignatedStopPoint >= -stopSafetyMargin * 2;
      if (
        isApproachingDesignatedStopPoint &&
        (this.state === "moving" || this.state === "idle")
      ) {
        for (const controlObj of allObjects) {
          if (controlObj.type === "Vehicle") continue;
          const control = controlObj.instance
            ? controlObj.instance
            : controlObj; // control is the TrafficControl instance
          // `control.mesh` gives the StopSign group. `control.position` is the base of the sign.
          // `control.placementZone` is the crucial link we added.
          const controlPlacementZone = control.placementZone; // Assume this will be set on TrafficControl objects when placed

          // General proximity check to the intersection boundary point
          const distanceControlToIntersectionEntry =
            control.position.distanceTo(intersectionBoundaryPoint);
          if (distanceControlToIntersectionEntry < checkDistanceToControls) {
            if (
              control.type === "StopSign" &&
              controlPlacementZone &&
              controlPlacementZone.affectedLaneDirections
            ) {
              // NEW LOGIC: Check if this sign's affectedLaneDirections includes our current direction
              let signApplies = false;
              for (const affectedDir of controlPlacementZone.affectedLaneDirections) {
                // Normalize both for accurate comparison (this.direction should already be normalized)
                const currentCarDirNormalized = this.direction
                  .clone()
                  .normalize();
                const affectedLaneDirNormalized = affectedDir
                  .clone()
                  .normalize();
                if (
                  currentCarDirNormalized.distanceToSquared(
                    affectedLaneDirNormalized
                  ) < 0.01
                ) {
                  // Check for near equality
                  signApplies = true;
                  break;
                }
              }
              if (signApplies) {
                if (this.satisfiedControls.has(control)) {
                  // console.log(`Vehicle ${this.id} skipping already satisfied StopSign ID ${control.mesh ? control.mesh.uuid.slice(0,5) : 'N/A'}`);
                  continue;
                }
                if (this.state !== "stopping" && this.state !== "stopped") {
                  this.state = "stopping";
                  this.targetStopPosition =
                    designatedCarCenterStopPosition.clone();
                  this.stoppingForControl = control;
                  this.stopTimer = SPEEDS.STOP_SIGN_DURATION;

                  this.position.copy(this.targetStopPosition);
                  this.mesh.position.copy(this.position);
                  this.mesh.position.y = SIZES.CAR_HEIGHT / 2;
                  if (this.direction.lengthSq() > 0.001) {
                    this.mesh.lookAt(this.position.clone().add(this.direction));
                  }
                  console.log(
                    `Vehicle ${
                      this.id
                    } initiating stop for StopSign (LANE MATCH). Target: ${this.targetStopPosition
                      .toArray()
                      .map((n) => n.toFixed(1))}. Sign at ${control.position
                      .toArray()
                      .map((n) => n.toFixed(1))}`
                  );
                  return; // Stop sign processed
                }
              }
            } else if (
              control.type === "TrafficLight" &&
              control.state === "red"
            ) {
              const toControlDir = controlPos
                .clone()
                .sub(this.position)
                .normalize();
              // Light must be generally in front of the car
              if (this.direction.dot(toControlDir) > 0.7) {
                if (this.state !== "stopped") {
                  // Ensure not already stopped for this or another reason
                  this.state = "stopped";
                  this.targetStopPosition =
                    designatedCarCenterStopPosition.clone();
                  this.stoppingForControl = control; // Store the light

                  this.position.copy(this.targetStopPosition); // Snap to stop position
                  this.mesh.position.copy(this.position);
                  this.mesh.position.y = SIZES.CAR_HEIGHT / 2;
                  if (this.direction.lengthSq() > 0.001) {
                    this.mesh.lookAt(this.position.clone().add(this.direction));
                  }
                  console.log(
                    `Vehicle ${
                      this.id
                    } stopping for RED LIGHT. Target: ${this.targetStopPosition
                      .toArray()
                      .map((n) => n.toFixed(1))}`
                  );
                  return; // Red light processed
                }
              }
            }
          }
        }
      }
      // Yielding checks for moving vehicles (can be outside the isApproachingDesignatedStopPoint block)
      // Yielding checks for moving vehicles
      const distanceToIntersection = this.getDistanceToIntersection();
      const amIApproachingIntersection =
        distanceToIntersection < SIZES.ROAD_WIDTH / 2 + SIZES.CAR_LENGTH * 1.0;
      if (this.isLeftTurnThroughIntersection && amIApproachingIntersection) {
        for (const obj of allObjects) {
          if (obj.type === "Vehicle") {
            const otherVehicle = obj.instance;
            if (otherVehicle === this) continue;
            const isOtherOncoming =
              this.direction.dot(otherVehicle.direction) < -0.7;
            const isOtherStraight =
              !otherVehicle.isLeftTurnThroughIntersection &&
              !otherVehicle.isRightTurnThroughIntersection;
            if (isOtherOncoming && isOtherStraight) {
              const otherDistanceToIntersection =
                otherVehicle.getDistanceToIntersection();
              if (
                otherDistanceToIntersection <
                  SIZES.ROAD_WIDTH / 2 + SIZES.CAR_LENGTH * 2.0 &&
                otherVehicle.state === "moving"
              ) {
                if (
                  otherDistanceToIntersection <
                  distanceToIntersection + SIZES.CAR_LENGTH * 0.5
                ) {
                  this.state = "stopping";
                  this.targetStopPosition = this.position.clone();
                  this.stopTimer = 1.0;
                  console.log(
                    `Vehicle ${this.id} (turning left) yielding to oncoming straight Vehicle ${otherVehicle.id}`
                  );
                  return;
                }
              }
            }
          }
        }
      }
      const isApproachingIntersection =
        distanceToIntersection < SIZES.ROAD_WIDTH / 2 + SIZES.CAR_LENGTH * 0.5;
      const isInIntersection = distanceToIntersection < SIZES.LANE_WIDTH * 0.5;
      if (isApproachingIntersection && !isInIntersection) {
        const carsWithRightOfWay = this.checkForCarsWithRightOfWay(allObjects);
        if (carsWithRightOfWay > 0) {
          this.state = "stopping";
          this.targetStopPosition = this.position.clone();
          this.stopTimer = SPEEDS.STOP_SIGN_DURATION * 0.5 + 0.5;
          console.log(
            `Vehicle ${this.id} yielding to vehicle with right of way.`
          );
          return;
        }
      }
    } // End of "if (this.state === 'moving')" block for traffic/yield checks
    // --- Movement Logic ---
    // This block now only runs if state is 'moving' AND hasn't returned from checks above
    if (this.state === "moving" || this.state === "idle") {
      // 'idle' to kickstart movement
      this.state = "moving"; // Ensure state is moving

      if (this.currentPathSegment >= this.path.length) {
        this.state = "finished"; // Reached end of path
        console.log("Car finished path");
        return;
      }

      this.targetPosition = this.path[this.currentPathSegment];
      const directionToTarget = this.targetPosition
        .clone()
        .sub(this.position)
        .normalize();
      const distanceToTarget = this.position.distanceTo(this.targetPosition);

      const moveDistance = this.speed * deltaTime;

      const TARGET_REACH_THRESHOLD = 0.05; // Small distance threshold
      if (distanceToTarget <= TARGET_REACH_THRESHOLD) {
        // --- Reached Target ---
        this.position.copy(this.targetPosition); // Snap to target precisely
        this.currentPathSegment++;
        // `satisfiedControls` are persistent until vehicle reset, no need to clear them here.
        if (this.currentPathSegment >= this.path.length) {
          // --- Reached FINAL Target ---
          this.state = "finished";
          this.position.copy(this.path[this.path.length - 1]); // Ensure exact final position
          console.log("Car reached final destination.");
        } else {
          // --- Reached Intermediate Target ---
          // Set next target for the *next* frame's calculation
          this.targetPosition = this.path[this.currentPathSegment];
          // Immediately calculate direction to the *new* target for orientation
          const nextDirection = this.targetPosition
            .clone()
            .sub(this.position)
            .normalize();
          if (nextDirection.lengthSq() > 0.001) {
            this.direction = nextDirection;
            this.mesh.lookAt(this.position.clone().add(this.direction));
          }
          console.log(
            `Car reached segment ${this.currentPathSegment - 1}, next target:`,
            this.targetPosition.toArray()
          );
        }
      } else if (moveDistance >= distanceToTarget) {
        // --- Overshot Target (but not within threshold) ---
        // Calculate overshoot AFTER moving to the target point this frame.
        const remainingMoveDistance = moveDistance - distanceToTarget;
        // Move exactly to the current target point first
        this.position.copy(this.targetPosition);
        // Advance segment
        this.currentPathSegment++;
        // `satisfiedControls` are persistent until vehicle reset.
        if (this.currentPathSegment < this.path.length) {
          // Get the next target and direction FROM THE CURRENT (just reached) POSITION
          const nextTargetPosition = this.path[this.currentPathSegment];
          const nextDirection = nextTargetPosition
            .clone()
            .sub(this.position)
            .normalize();
          // Apply the remaining movement distance towards the *next* target
          if (nextDirection.lengthSq() > 0.001 && remainingMoveDistance > 0) {
            this.position.addScaledVector(nextDirection, remainingMoveDistance);
            this.direction = nextDirection; // Update current direction
            this.mesh.lookAt(this.position.clone().add(this.direction)); // Orient towards new direction
          }
          // Update the main targetPosition for the next frame's calculation
          this.targetPosition = nextTargetPosition;
        } else {
          // Overshot the FINAL point
          this.state = "finished";
          this.position.copy(this.path[this.path.length - 1]); // Ensure exact final position
          console.log("Car overshot final destination.");
        }
      } else {
        // --- Moving Towards Target ---
        this.position.addScaledVector(directionToTarget, moveDistance);
        if (directionToTarget.lengthSq() > 0.001) {
          this.mesh.lookAt(this.position.clone().add(directionToTarget));
          this.direction = directionToTarget; // Update internal direction for traffic checks etc.
        }
      }

      // Update mesh position at the end of all calculations for the frame
      this.mesh.position.copy(this.position);
      this.mesh.position.y = SIZES.CAR_HEIGHT / 2; // Keep it on the ground
      // Ensure mesh orientation is correct based on final position and direction for the frame
      if (this.state === "moving" && this.direction.lengthSq() > 0.001) {
        this.mesh.lookAt(this.position.clone().add(this.direction));
      }
    }
  }

  // Calculate distance to intersection center
  getDistanceToIntersection() {
    // The intersection center is at (0,0,0)
    const intersectionCenter = new THREE.Vector3(0, 0, 0);
    return this.position.distanceTo(intersectionCenter);
  }

  // Check if there are other cars with right of way (approaching from the right)
  checkForCarsWithRightOfWay(allObjects) {
    const vehicles = [];
    for (const obj of allObjects) {
      if (obj.type === "Vehicle" && obj.instance !== this) {
        vehicles.push(obj.instance);
      }
    }

    // Create a "right" vector relative to current direction
    const right = new THREE.Vector3();
    right.crossVectors(this.direction, new THREE.Vector3(0, 1, 0)).normalize();

    // Distance to check for other vehicles
    const vehicleCheckDistance = SIZES.ROAD_WIDTH * 1.5;
    let carsWithRightOfWay = 0;

    for (const otherVehicle of vehicles) {
      const distanceToOther = this.position.distanceTo(otherVehicle.position);
      if (distanceToOther > vehicleCheckDistance) continue; // Other vehicle is too far away
      // This check is specifically for when *both* cars have completed their mandatory stop
      // at different stop signs and are now deciding who goes first.
      const isOtherContendingAtStopSignAfterStop =
        otherVehicle.state === "stopping" && // Is it in the 'stopping' state (timer may be running down for yield)?
        otherVehicle.stoppingForControl && // Does it have a control it's stopping for?
        otherVehicle.stoppingForControl.type === "StopSign" && // Is that control a StopSign?
        otherVehicle.stopTimer < 0.01; // Stricter check: Has its *mandatory* stop time fully elapsed?

      if (!isOtherContendingAtStopSignAfterStop) {
        // console.log(`Vehicle ${this.id} CHECKS Vehicle ${otherVehicle.id}: Not contending (state: ${otherVehicle.state}, stopTimer: ${otherVehicle.stopTimer.toFixed(3)}s)`);
        continue;
      }
      // console.log(`Vehicle ${this.id} CHECKS Vehicle ${otherVehicle.id}: IS CONTENDING (state: ${otherVehicle.state}, stopTimer: ${otherVehicle.stopTimer.toFixed(3)}s)`);

      // Check if other vehicle is generally to our right
      const toOtherVehicle = otherVehicle.position
        .clone()
        .sub(this.position)
        .normalize();
      const rightwardness = toOtherVehicle.dot(right);

      // Check if the other vehicle is positioned at the intersection.
      const otherIsAtIntersection =
        otherVehicle.position.length() <
        SIZES.ROAD_WIDTH + SIZES.LANE_WIDTH * 2;
      if (rightwardness > 0.5 && otherIsAtIntersection) {
        carsWithRightOfWay++;
        console.log(
          `Vehicle ${this.id} (myTimer ${this.stopTimer.toFixed(
            2
          )}s) WILL YIELD to Vehicle ${
            otherVehicle.id
          } (theirTimer ${otherVehicle.stopTimer.toFixed(
            2
          )}s, on my right) at multi-way stop.`
        );
      } else {
        // console.log(`Vehicle ${this.id} (myTimer ${this.stopTimer.toFixed(2)}s) WILL NOT YIELD to Vehicle ${otherVehicle.id} (theirTimer ${otherVehicle.stopTimer.toFixed(2)}s). Rightwardness: ${rightwardness.toFixed(2)}, OtherAtIntersection: ${otherIsAtIntersection}`);
      }
    }

    return carsWithRightOfWay;
  }
  reset() {
    this.position.copy(this.startPosition);
    this.mesh.position.copy(this.startPosition);
    this.mesh.position.y = SIZES.CAR_HEIGHT / 2;
    this.direction = this.calculateInitialDirection(); // Recalculate initial direction based on start position? Or use original?
    this.mesh.lookAt(this.position.clone().add(this.direction));
    this.state = "idle";
    this.currentPathSegment = 0;
    this.stopTimer = 0;
    this.targetStopPosition = null;
    this.stoppingForControl = null;
    this.satisfiedControls.clear(); // Clear the set of satisfied stop signs
    if (this.path.length > 0) {
      this.targetPosition = this.path[0];
    }
  }

  // Helper to potentially recalculate initial direction if needed on reset
  calculateInitialDirection() {
    // This needs logic based on which lane the car starts in.
    // For now, just return the original direction.
    // In a more complex system, this would look up the starting zone's direction.
    return this.direction.clone();
  }
  setPathVisualizer(visualizer) {
    this.pathVisualizer = visualizer;
    if (this.pathVisualizer && this.path && this.path.length > 0) {
      this.pathVisualizer.visualizePath(this, this.path);
    }
  }
  dispose() {
    // Clean up path visualization if it exists
    if (this.pathVisualizer) {
      this.pathVisualizer.clearPath(this);
      this.pathVisualizer = null;
    }
  }
  // Helper method to determine if a vehicle is currently obligated to stop for a control it's facing
  isVehicleCurrentlyObligatedToStop(vehicleToCheck, allObjects) {
    const checkDistance = SIZES.CAR_LENGTH * 1.5 + vehicleToCheck.speed * 0.1; // Dynamic check distance
    const stopSafetyMargin = 0.05;
    for (const controlObj of allObjects) {
      if (controlObj.type === "Vehicle") continue;
      const controlInstance = controlObj.instance || controlObj;
      const controlPos = controlInstance.mesh.position;
      const distanceToCtrl = vehicleToCheck.position.distanceTo(controlPos);
      if (distanceToCtrl >= checkDistance) continue;
      const toCtrlDir = controlPos
        .clone()
        .sub(vehicleToCheck.position)
        .normalize();
      if (vehicleToCheck.direction.dot(toCtrlDir) <= 0.7) continue; // Not reasonably facing it
      if (
        controlInstance.type === "TrafficLight" &&
        controlInstance.state === "red"
      ) {
        // Check if front of car is before or at its first path point (approx stop line)
        if (vehicleToCheck.path.length > 0) {
          const stopLine = vehicleToCheck.path[0];
          const vecToStopLine = stopLine.clone().sub(vehicleToCheck.position);
          const distToStopLine = vecToStopLine.length();
          // If moving towards stop line and close enough to stop next frame
          if (
            vehicleToCheck.direction.dot(vecToStopLine.normalize()) > 0.5 &&
            distToStopLine <
              vehicleToCheck.speed * (1 / 30) + SIZES.CAR_LENGTH / 2
          ) {
            return true; // Obligated for red light
          }
        }
      } else if (controlInstance.type === "StopSign") {
        if (vehicleToCheck.path.length > 0) {
          const intersectionBoundaryPoint = vehicleToCheck.path[0];
          const stopOffsetDist = SIZES.CAR_LENGTH / 2 + stopSafetyMargin;
          const designatedStopPos = intersectionBoundaryPoint
            .clone()
            .sub(
              vehicleToCheck.direction.clone().multiplyScalar(stopOffsetDist)
            );
          const distToDesignatedStop =
            vehicleToCheck.position.distanceTo(designatedStopPos);
          if (
            distToDesignatedStop <
            vehicleToCheck.speed * (1 / 30) + SIZES.CAR_LENGTH * 0.1
          ) {
            // Close enough to be stopping
            return true; // Obligated for stop sign
          }
        }
      }
    }
    return false;
  }
  mustYieldToPrivilegedTraffic(allObjects) {
    const intersectionCenter = new THREE.Vector3(0, 0, 0);
    const detectionRadius = SIZES.ROAD_WIDTH + SIZES.CAR_LENGTH * 2.5; // Max distance from intersection center for otherCar
    const myLookaheadSegments = 2; // How many segments ahead to check for 'this' car
    const otherLookaheadSegments = 3; // How many segments ahead to check for 'otherCar'
    const YIELD_TIME_BUFFER = 0.2; // seconds. Yield if other car arrives earlier, or slightly after (within this buffer).
    const MIN_OTHER_CAR_TIME_TO_CONFLICT = -0.1; // seconds. Don't yield if other car passed conflict more than this much time ago.
    for (const obj of allObjects) {
      if (obj.type !== "Vehicle" || obj.instance === this) continue;
      const otherCar = obj.instance;
      if (otherCar.state !== "moving" || otherCar.speed === 0) continue; // Skip non-moving or speedless cars
      const otherDistToCenter =
        otherCar.position.distanceTo(intersectionCenter);
      if (otherDistToCenter > detectionRadius) continue; // Other car too far
      // Check if otherCar is "privileged" (i.e., not obligated to stop for its own reasons)
      if (this.isVehicleCurrentlyObligatedToStop(otherCar, allObjects)) {
        continue; // otherCar has to stop for its own red light/stop sign, so it's not privileged to proceed
      }
      // Now, otherCar is moving, near/in intersection, and not stopping for its own control.
      // We need to check for path conflict.
      const myPath = this.path;
      const myCurrentSegmentIdx = this.currentPathSegment;
      const otherPath = otherCar.path;
      const otherCurrentSegmentIdx = otherCar.currentPathSegment;
      // Ensure paths and current segments are valid
      if (
        myPath.length <= myCurrentSegmentIdx ||
        myPath.length < 2 ||
        otherPath.length <= otherCurrentSegmentIdx ||
        otherPath.length < 2
      ) {
        continue;
      }
      for (let i = 0; i < myLookaheadSegments; i++) {
        const mySegIdx = myCurrentSegmentIdx + i;
        if (mySegIdx + 1 >= myPath.length) break; // Not enough segments in my path
        const mySegStart = myPath[mySegIdx];
        const mySegEnd = myPath[mySegIdx + 1];
        for (let j = 0; j < otherLookaheadSegments; j++) {
          const otherSegIdx = otherCurrentSegmentIdx + j;
          if (otherSegIdx + 1 >= otherPath.length) break; // Not enough segments in other's path
          const otherSegStart = otherPath[otherSegIdx];
          const otherSegEnd = otherPath[otherSegIdx + 1];
          const intersectionPoint = this.calculateLineSegmentIntersection(
            mySegStart,
            mySegEnd,
            otherSegStart,
            otherSegEnd
          );
          if (intersectionPoint) {
            let distThisToConflict = 0;
            // Dist from current pos to start of its current actual segment
            distThisToConflict += this.position.distanceTo(
              myPath[myCurrentSegmentIdx]
            );
            // Sum lengths of full segments between car's current segment and start of mySegIdx (the conflicting one)
            for (let k = myCurrentSegmentIdx; k < mySegIdx; k++) {
              distThisToConflict += myPath[k].distanceTo(myPath[k + 1]);
            }
            // Dist from start of mySeg (conflicting segment) to intersection point
            distThisToConflict += mySegStart.distanceTo(intersectionPoint);
            const timeThisToConflict =
              this.speed > 0 ? distThisToConflict / this.speed : Infinity;
            let distOtherToConflict = 0;
            distOtherToConflict += otherCar.position.distanceTo(
              otherPath[otherCurrentSegmentIdx]
            );
            for (let k = otherCurrentSegmentIdx; k < otherSegIdx; k++) {
              distOtherToConflict += otherPath[k].distanceTo(otherPath[k + 1]);
            }
            distOtherToConflict += otherSegStart.distanceTo(intersectionPoint);
            const timeOtherToConflict =
              otherCar.speed > 0
                ? distOtherToConflict / otherCar.speed
                : Infinity;
            // Yield if other car is close to conflict OR will arrive before/concurrently with this car.
            // Do not yield if other car has already passed the conflict point by a small margin.
            if (
              timeOtherToConflict <= timeThisToConflict + YIELD_TIME_BUFFER &&
              timeOtherToConflict > MIN_OTHER_CAR_TIME_TO_CONFLICT
            ) {
              console.log(
                `Vehicle ${this.id} yielding to privileged Vehicle ${
                  otherCar.id
                }. My time: ${timeThisToConflict.toFixed(
                  1
                )}, Other time: ${timeOtherToConflict.toFixed(
                  1
                )}, Buffer: ${YIELD_TIME_BUFFER}, MinOtherT: ${MIN_OTHER_CAR_TIME_TO_CONFLICT}`
              );
              return true; // Must yield
            }
          }
        }
      }
    }
    return false; // No conflict found that requires yielding
  }
  // Helper method to calculate intersection of two line segments on XZ plane
  calculateLineSegmentIntersection(p1, p2, p3, p4) {
    const x1 = p1.x,
      z1 = p1.z;
    const x2 = p2.x,
      z2 = p2.z;
    const x3 = p3.x,
      z3 = p3.z;
    const x4 = p4.x,
      z4 = p4.z;
    // Denominator for the equations
    const den = (x1 - x2) * (z3 - z4) - (z1 - z2) * (x3 - x4);
    if (den === 0) {
      return null; // Lines are parallel or collinear
    }
    // Numerator for parameter t (for segment p1-p2)
    const tNum = (x1 - x3) * (z3 - z4) - (z1 - z3) * (x3 - x4);
    // Numerator for parameter u (for segment p3-p4)
    const uNum = -((x1 - x2) * (z1 - z3) - (z1 - z2) * (x1 - x3));
    const t = tNum / den;
    const u = uNum / den;
    // If parameters t and u are between 0 and 1, segments intersect
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      const intersectX = x1 + t * (x2 - x1);
      const intersectZ = z1 + t * (z2 - z1);
      // Assume y-coordinate is same as p1 (paths are on a flat plane relative to vehicle start)
      return new THREE.Vector3(intersectX, p1.y, intersectZ);
    }
    return null; // No intersection within the segments
  }
}
