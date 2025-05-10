export class UI {
    constructor(container, placementController, simulation) {
        this.container = container; // Usually document.body or a specific UI container div
        this.placementController = placementController;
        this.simulation = simulation;
        this.uiPanel = null;
    }

    createUI() {
        this.uiPanel = document.createElement('div');
        this.uiPanel.id = 'uiPanel';
        this.applyStyles(this.uiPanel, {
            position: 'absolute',
            bottom: '0',
            left: '0',
            width: '100%',
            height: '80px', // Fixed height for the panel
            backgroundColor: 'rgba(50, 50, 50, 0.8)',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            padding: '10px',
            boxSizing: 'border-box',
            zIndex: '10',
            color: 'white',
            fontFamily: 'sans-serif'
        });

        // Object Selection Section
        const selectionDiv = document.createElement('div');
        this.applyStyles(selectionDiv, { display: 'flex', gap: '10px' });
        selectionDiv.appendChild(this.createButton('Car', () => this.placementController.setSelectedObjectType('Car')));
        selectionDiv.appendChild(this.createButton('Stop Sign', () => this.placementController.setSelectedObjectType('StopSign')));
        selectionDiv.appendChild(this.createButton('Traffic Light', () => this.placementController.setSelectedObjectType('TrafficLight')));
        selectionDiv.appendChild(this.createButton('Clear Selection', () => this.placementController.setSelectedObjectType(null)));

        // Simulation Control Section
        const controlDiv = document.createElement('div');
        this.applyStyles(controlDiv, { display: 'flex', gap: '10px' });
        controlDiv.appendChild(this.createButton('Play', () => this.simulation.play()));
        controlDiv.appendChild(this.createButton('Pause', () => this.simulation.pause()));
        controlDiv.appendChild(this.createButton('Reset Sim', () => this.simulation.reset()));
         controlDiv.appendChild(this.createButton('Clear All', () => {
            this.simulation.reset(); // Stop sim first
            this.objectManager.removeAllObjects(); // Then remove objects
         }));
        
        // Path Visualization Toggle
        this.isPathVisible = true; // Default to visible
        const pathToggleDiv = document.createElement('div');
        this.applyStyles(pathToggleDiv, { display: 'flex', alignItems: 'center', gap: '5px'});
        const pathToggleButton = this.createButton('Paths: On', () => this.togglePathVisibility(pathToggleButton));
        pathToggleDiv.appendChild(document.createTextNode('Debug: '));
        pathToggleDiv.appendChild(pathToggleButton);
        this.uiPanel.appendChild(document.createTextNode('Place: '));
        this.uiPanel.appendChild(selectionDiv);
        this.uiPanel.appendChild(document.createTextNode('Simulate: '));
        this.uiPanel.appendChild(controlDiv);
        this.uiPanel.appendChild(pathToggleDiv);

        this.container.appendChild(this.uiPanel);
    }

    createButton(text, onClick) {
        const button = document.createElement('button');
        button.textContent = text;
        this.applyStyles(button, {
            padding: '8px 15px',
            fontSize: '14px',
            cursor: 'pointer',
            backgroundColor: '#4CAF50', // Green
            color: 'white',
            border: 'none',
            borderRadius: '4px',
             minWidth: '80px' // Ensure buttons have some width
        });
         // Add simple hover effect via JS
         button.onmouseenter = () => button.style.backgroundColor = '#45a049';
         button.onmouseleave = () => button.style.backgroundColor = '#4CAF50';

        button.addEventListener('click', onClick);
        return button;
    }

    // Helper to apply multiple styles
    applyStyles(element, styles) {
        for (const property in styles) {
            element.style[property] = styles[property];
        }
    }

     // Make objectManager accessible for the Clear All button
     setObjectManager(objectManager){
        this.objectManager = objectManager;
     }
    togglePathVisibility(button) {
        this.isPathVisible = !this.isPathVisible;
        button.textContent = `Paths: ${this.isPathVisible ? 'On' : 'Off'}`;
        if (this.objectManager && this.objectManager.togglePathVisibility) {
            this.objectManager.togglePathVisibility(this.isPathVisible);
        }
    }
}
// Add objectManager after UI is created in main.js
// Find the line: const ui = new UI(document.body, placementController, simulation);
// Add below it: ui.setObjectManager(objectManager);
// (Self-correction: Need objectManager in UI for Clear All) - Added setObjectManager