import * as THREE from "https://esm.sh/three@0.171.0";
import { COLORS, SIZES } from "./constants.js";

export class Crossroad {
  constructor(scene) {
    this.scene = scene;
    this.placementZones = []; // Stores { position: Vector3, type: 'lane'/'corner', direction?: Vector3, mesh: Mesh }
  }

  create() {
    const roadWidth = SIZES.ROAD_WIDTH;
    const roadLength = SIZES.ROAD_LENGTH; // Length of arms from center
    const laneWidth = SIZES.LANE_WIDTH;

    // Materials
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.ROAD_GRAY,
    });
    const lineMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.LINE_YELLOW,
    });
    const whiteLineMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.LINE_WHITE,
    });

    // Center piece
    const centerGeo = new THREE.PlaneGeometry(roadWidth, roadWidth);
    const centerMesh = new THREE.Mesh(centerGeo, roadMaterial);
    centerMesh.rotation.x = -Math.PI / 2;
    this.scene.add(centerMesh);

    // Road Arms (N, S, E, W)
    const armGeo = new THREE.PlaneGeometry(roadWidth, roadLength);
    const arms = [
      { pos: [0, 0, -(roadLength / 2 + roadWidth / 2)], rot: 0 }, // North
      { pos: [0, 0, roadLength / 2 + roadWidth / 2], rot: 0 }, // South
      { pos: [roadLength / 2 + roadWidth / 2, 0, 0], rot: Math.PI / 2 }, // East
      { pos: [-(roadLength / 2 + roadWidth / 2), 0, 0], rot: Math.PI / 2 }, // West
    ];

    arms.forEach((armData) => {
      const armMesh = new THREE.Mesh(armGeo, roadMaterial);
      armMesh.position.set(...armData.pos);
      armMesh.rotation.x = -Math.PI / 2;
      armMesh.rotation.z = armData.rot;
      this.scene.add(armMesh);
    });

    // Lane Lines (Simplified - Center dashed yellow)
    const lineLength = roadLength * 2 + roadWidth;
    const lineGeo = new THREE.PlaneGeometry(
      SIZES.LINE_THICKNESS * 2,
      lineLength
    ); // Yellow line wider

    const yellowLineZ = new THREE.Mesh(lineGeo, lineMaterial);
    yellowLineZ.rotation.x = -Math.PI / 2;
    yellowLineZ.position.y = 0.01; // Slightly above road
    this.scene.add(yellowLineZ);

    const yellowLineX = new THREE.Mesh(lineGeo, lineMaterial);
    yellowLineX.rotation.x = -Math.PI / 2;
    yellowLineX.rotation.z = Math.PI / 2;
    yellowLineX.position.y = 0.01;
    this.scene.add(yellowLineX);

    // Placement Zones (Simplified - entry/exit points and corners)
    const zoneSize = laneWidth * 0.8;
    const zoneGeo = new THREE.BoxGeometry(zoneSize, 0.1, zoneSize);
    const zoneMatLane = new THREE.MeshBasicMaterial({
      color: COLORS.ZONE_LANE,
      transparent: true,
      opacity: 0.3,
    });
    const zoneMatCorner = new THREE.MeshBasicMaterial({
      color: COLORS.ZONE_CORNER,
      transparent: true,
      opacity: 0.3,
    });

    const halfRoadW = roadWidth / 2;
    const halfLaneW = laneWidth / 2;
    const armEnd = halfRoadW + roadLength;

    // Lane Zones (Entry points) - Simplified
    const lanePositions = [
      // Northbound lanes (approaching from South)
      {
        pos: new THREE.Vector3(-halfLaneW, 0.05, armEnd),
        type: "lane_entry",
        laneType: "right",
        dir: new THREE.Vector3(0, 0, -1),
      },
      {
        pos: new THREE.Vector3(halfLaneW, 0.05, armEnd),
        type: "lane_entry",
        laneType: "left",
        dir: new THREE.Vector3(0, 0, -1),
      },
      // Southbound lanes (approaching from North)
      {
        pos: new THREE.Vector3(halfLaneW, 0.05, -armEnd),
        type: "lane_entry",
        laneType: "right",
        dir: new THREE.Vector3(0, 0, 1),
      },
      {
        pos: new THREE.Vector3(-halfLaneW, 0.05, -armEnd),
        type: "lane_entry",
        laneType: "left",
        dir: new THREE.Vector3(0, 0, 1),
      },
      // Eastbound lanes (approaching from West)
      {
        pos: new THREE.Vector3(-armEnd, 0.05, -halfLaneW),
        type: "lane_entry",
        laneType: "right",
        dir: new THREE.Vector3(1, 0, 0),
      },
      {
        pos: new THREE.Vector3(-armEnd, 0.05, halfLaneW),
        type: "lane_entry",
        laneType: "left",
        dir: new THREE.Vector3(1, 0, 0),
      },
      // Westbound lanes (approaching from East)
      {
        pos: new THREE.Vector3(armEnd, 0.05, halfLaneW),
        type: "lane_entry",
        laneType: "right",
        dir: new THREE.Vector3(-1, 0, 0),
      },
      {
        pos: new THREE.Vector3(armEnd, 0.05, -halfLaneW),
        type: "lane_entry",
        laneType: "left",
        dir: new THREE.Vector3(-1, 0, 0),
      },
    ];

    // Corner Zones (for signs/lights)
    const cornerOffset = halfRoadW + 1; // Place slightly off the road
    const cornerPositions = [
      {
        pos: new THREE.Vector3(cornerOffset, 0.05, cornerOffset),
        type: "corner",
      }, // SE
      {
        pos: new THREE.Vector3(-cornerOffset, 0.05, cornerOffset),
        type: "corner",
      }, // SW
      {
        pos: new THREE.Vector3(cornerOffset, 0.05, -cornerOffset),
        type: "corner",
      }, // NE
      {
        pos: new THREE.Vector3(-cornerOffset, 0.05, -cornerOffset),
        type: "corner",
      }, // NW
    ];

    const createZoneMesh = (pos, material) => {
      const mesh = new THREE.Mesh(zoneGeo, material);
      mesh.position.copy(pos);
      mesh.visible = false; // Initially hidden, shown on hover/selection mode
      mesh.userData.isPlacementZone = true; // Flag for raycasting
      this.scene.add(mesh);
      return mesh;
    };

    lanePositions.forEach((data) => {
      const mesh = createZoneMesh(data.pos, zoneMatLane);
      this.placementZones.push({ ...data, mesh });
    });

    cornerPositions.forEach((data) => {
      const mesh = createZoneMesh(data.pos, zoneMatCorner);
      this.placementZones.push({ ...data, mesh });
    });
  }

  getPlacementZones() {
    return this.placementZones;
  }

  // Method to show/hide zones during placement mode
  toggleZoneVisibility(visible) {
    this.placementZones.forEach((zone) => (zone.mesh.visible = visible));
  }
}
