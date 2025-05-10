import * as THREE from "https://esm.sh/three@0.171.0";

export class Game {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer({ antialias: true });

    this.setupRenderer();
    this.setupCamera();
    this.setupLights();
    this.setupScene();

    window.addEventListener("resize", this.onWindowResize.bind(this));
  }

  setupRenderer() {
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x87ceeb); // Sky blue background
    this.container.appendChild(this.renderer.domElement);
  }

  setupCamera() {
    this.camera.position.set(0, 30, 25); // Elevated view
    this.camera.lookAt(0, 0, 0);
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    this.scene.add(directionalLight);
  }

  setupScene() {
    // Add a simple ground plane
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x556b2f,
      side: THREE.DoubleSide,
    }); // Dark Olive Green
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    ground.position.y = -0.1; // Slightly below objects
    this.scene.add(ground);

    // Add basic orbit controls for debugging/viewing
    // NOTE: For a real app, controls might be fixed or custom
    import(
      "https://esm.sh/three@0.171.0/examples/jsm/controls/OrbitControls.js"
    ).then(({ OrbitControls }) => {
      const controls = new OrbitControls(this.camera, this.renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.screenSpacePanning = false;
      controls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent looking under ground
      controls.minDistance = 10;
      controls.maxDistance = 50;
      controls.update();
      this.controls = controls; // Store controls if needed
    });
  }

  onWindowResize() {
    this.camera.aspect =
      this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
  }

  render() {
    if (this.controls) this.controls.update(); // Update orbit controls if they exist
    this.renderer.render(this.scene, this.camera);
  }
}
