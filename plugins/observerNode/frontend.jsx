import ObserverNode from './ObserverNode.jsx';
import { uiRegistry } from '../../front-editor/src/core/uiRegistry';

uiRegistry.registerNodeType({
    type: 'ObserverNode',
    component: ObserverNode,
    config: {
        type: 'ObserverNode',
        label: 'Observer',
        colorVar: '--color-observer',
        color: '#00d2d3',
        category: 'Output'
    },
    defaultData: {
        title: 'Observer',
        inputs: [{ id: 'in1', name: 'input' }],
        outputs: []
    }
});

uiRegistry.registerDemo("Data Visualization (Matplotlib)", {
    "nodes": [
        {
            "id": "501",
            "type": "ManualNode",
            "position": { "x": 100, "y": 150 },
            "data": {
                "title": "Sine Wave Generator",
                "code": "import matplotlib.pyplot as plt\nimport numpy as np\n\nfig, ax = plt.subplots(figsize=(5, 3))\n\n# Generate data\nx = np.linspace(0, 10, 100)\ny1 = np.sin(x)\ny2 = np.cos(x)\n\n# Create plot\nax.plot(x, y1, label='sin(x)', color='blue')\nax.plot(x, y2, label='cos(x)', color='red', linestyle='--')\nax.set_title('Trigonometric Functions')\nax.legend()\n\nplot_output = fig",
                "outputs": [{ "id": "out-plot", "name": "plot_output" }]
            }
        },
        {
            "id": "502",
            "type": "ObserverNode",
            "position": { "x": 550, "y": 150 },
            "data": {
                "title": "Plot Viewer",
                "inputs": [{ "id": "in1", "name": "plot_output" }]
            }
        }
    ],
    "edges": [
        { "id": "e501-502", "source": "501", "sourceHandle": "out-plot", "target": "502", "targetHandle": null }
    ]
});

uiRegistry.registerDemo("Data Tables (Pandas)", {
    "nodes": [
        {
            "id": "601",
            "type": "ManualNode",
            "position": { "x": 100, "y": 150 },
            "data": {
                "title": "DataFrame Generator",
                "code": "import pandas as pd\nimport numpy as np\n\ndata = {\n    'Employee': ['Alice', 'Bob', 'Charlie', 'David', 'Eve'],\n    'Department': ['IT', 'HR', 'Finance', 'IT', 'Marketing'],\n    'Salary': [75000, 62000, 85000, 72000, 58000],\n    'Performance': [4.5, 3.8, 4.9, 4.1, 3.5]\n}\n\ndf = pd.DataFrame(data)\ndf['Bonus'] = np.where(df['Performance'] > 4.0, df['Salary'] * 0.1, 0)\n\ntable_output = df",
                "outputs": [{ "id": "out-table", "name": "table_output" }]
            }
        },
        {
            "id": "602",
            "type": "ObserverNode",
            "position": { "x": 550, "y": 150 },
            "data": {
                "title": "Table Viewer",
                "inputs": [{ "id": "in1", "name": "table_output" }]
            }
        }
    ],
    "edges": [
        { "id": "e601-602", "source": "601", "sourceHandle": "out-table", "target": "602", "targetHandle": null }
    ]
});
