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
    const isRightTurn = crossProductY > 0.1;
    const isLeftTurn = crossProductY < -0.1;
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

  update(deltaTime, trafficControls) {
    if (this.state === "stopped") return;

    if (this.state === "stopping") {
      this.stopTimer -= deltaTime;
      if (this.stopTimer <= 0) {
        this.state = "moving"; // Resume movement
      } else {
        return; // Remain stopped
      }
    }
    // Basic Traffic Control Check (simplified: check nearest ahead)
    const checkDistance = SIZES.CAR_LENGTH; // About 1.5 car lengths ahead
    const checkPoint = this.position
      .clone()
      .addScaledVector(this.direction, checkDistance);
    // First check for traffic controls (signs and lights)
    for (const control of trafficControls) {
      // Skip vehicle objects when checking for traffic controls
      if (control.type === "Vehicle") continue;

      const controlPos = control.mesh.position;
      // Simple distance check and rough direction check
      if (
        controlPos.distanceTo(this.position) <
        checkDistance + SIZES.LANE_WIDTH
      ) {
        const toControl = controlPos.clone().sub(this.position).normalize();
        // Check if control is roughly in front of the car
        if (this.direction.dot(toControl) > 0.7) {
          // Control is generally ahead
          if (control.type === "TrafficLight" && control.state === "red") {
            this.state = "stopped"; // Full stop for red light
            console.log("Car stopped for red light");
            return;
          } else if (control.type === "StopSign" && this.state !== "stopped") {
            this.state = "stopping";
            this.stopTimer = SPEEDS.STOP_SIGN_DURATION; // Pause duration
            console.log("Car stopping for stop sign");
            return; // Start the stop timer
          }
        }
      }
    }
    // Check if we're approaching the intersection
    const distanceToIntersection = this.getDistanceToIntersection();
    const isApproachingIntersection =
      distanceToIntersection < SIZES.ROAD_WIDTH / 2 + SIZES.CAR_LENGTH;
    const isInIntersection = distanceToIntersection < 0.5; // Already in the intersection
    // Only check for right-of-way if we're near intersection but not already in it
    if (
      isApproachingIntersection &&
      !isInIntersection &&
      this.state === "moving"
    ) {
      const carsWithRightOfWay =
        this.checkForCarsWithRightOfWay(trafficControls);

      if (carsWithRightOfWay > 0) {
        // Yield to car on the right by stopping
        this.state = "stopping";
        this.stopTimer = SPEEDS.STOP_SIGN_DURATION * 0.5; // Half the regular stop duration
        console.log("Car yielding to vehicle with right of way");
        return;
      }
    }

    // --- Movement ---
    if (this.state === "moving" || this.state === "idle") {
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
  checkForCarsWithRightOfWay(trafficControls) {
    // Get all vehicles from traffic controls
    const vehicles = [];
    for (const control of trafficControls) {
      if (control.type === "Vehicle") {
        // Access the actual vehicle instance from the object passed
        const otherVehicle = control.instance;
        // Skip self
        if (otherVehicle === this) continue;
        vehicles.push(otherVehicle);
      }
    }

    // Create a "right" vector relative to current direction
    const right = new THREE.Vector3();
    right.crossVectors(this.direction, new THREE.Vector3(0, 1, 0)).normalize();

    // Distance to check for other vehicles
    const vehicleCheckDistance = SIZES.ROAD_WIDTH * 1.5;
    let carsWithRightOfWay = 0;

    for (const otherVehicle of vehicles) {
      // Skip if other vehicle isn't approaching intersection
      if (otherVehicle.state !== "moving") continue;

      const distanceToOther = this.position.distanceTo(otherVehicle.position);
      if (distanceToOther > vehicleCheckDistance) continue;

      // Check if other vehicle is generally to our right
      const toOtherVehicle = otherVehicle.position
        .clone()
        .sub(this.position)
        .normalize();
      const rightwardness = toOtherVehicle.dot(right);

      // Check if other vehicle is heading toward intersection
      const otherToIntersection = new THREE.Vector3()
        .sub(otherVehicle.position)
        .normalize();
      const isHeadingToIntersection =
        otherVehicle.direction.dot(otherToIntersection) > 0.5;

      if (rightwardness > 0.5 && isHeadingToIntersection) {
        carsWithRightOfWay++;
        console.log(
          "Vehicle yielding to vehicle on the right",
          this.position.toArray(),
          "->",
          otherVehicle.position.toArray()
        );
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
}
