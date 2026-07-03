export const demos = {
    "Math & Logic (FastNode)": {
      "nodes": [
        { "id": "101", "type": "NumberNode", "position": { "x": 100, "y": 100 }, "data": { "title": "A", "state": 0, "value": 10, "outputs": [{ "id": "output", "name": "output", "type": "int", "value": 10 }] } },
        { "id": "102", "type": "NumberNode", "position": { "x": 100, "y": 250 }, "data": { "title": "B", "state": 0, "value": 5, "outputs": [{ "id": "output", "name": "output", "type": "int", "value": 5 }] } },
        { "id": "103", "type": "FastNode", "position": { "x": 400, "y": 150 }, "data": { "title": "Multiply", "state": 0, "code": "result = A * B", "inputs": [{ "id": "in-A", "name": "A" }, { "id": "in-B", "name": "B" }], "outputs": [{ "id": "out-result", "name": "result" }] } },
        { "id": "104", "type": "ObserverNode", "position": { "x": 700, "y": 150 }, "data": { "title": "Result", "state": 0 } }
      ],
      "edges": [
        { "id": "e101-103", "source": "101", "sourceHandle": "output", "target": "103", "targetHandle": "in-A" },
        { "id": "e102-103", "source": "102", "sourceHandle": "output", "target": "103", "targetHandle": "in-B" },
        { "id": "e103-104", "source": "103", "sourceHandle": "out-result", "target": "104", "targetHandle": null }
      ]
    },
    "Text Processing (FastNode)": {
      "nodes": [
        { "id": "201", "type": "StringNode", "position": { "x": 60, "y": 150 }, "data": { "title": "Input Text", "state": 0, "value": "Hello NodalPy", "code": "output = \"Hello NodalPy\"", "outputs": [{ "id": "output", "name": "output", "type": "str", "value": "Hello NodalPy" }] } },
        { "id": "202", "type": "FastNode", "position": { "x": 340, "y": 150 }, "data": { "title": "Transform", "state": 0, "code": "text = str(output) if output is not None else ''\nwords = text.split()\nupper_text = text.upper()\nword_count = len(words)", "inputs": [{ "id": "in-202", "name": "output" }], "outputs": [{ "id": "out-upper-202", "name": "upper_text" }, { "id": "out-count-202", "name": "word_count" }] } },
        { "id": "203", "type": "ObserverNode", "position": { "x": 680, "y": 100 }, "data": { "title": "Upper Text", "state": 0 } },
        { "id": "204", "type": "ObserverNode", "position": { "x": 680, "y": 280 }, "data": { "title": "Word Count", "state": 0 } }
      ],
      "edges": [
        { "id": "e201-202", "source": "201", "sourceHandle": "output", "target": "202", "targetHandle": "in-202" },
        { "id": "e202-203", "source": "202", "sourceHandle": "out-upper-202", "target": "203", "targetHandle": null },
        { "id": "e202-204", "source": "202", "sourceHandle": "out-count-202", "target": "204", "targetHandle": null }
      ]
    },
    "Data Viz (Matplotlib)": {
      "nodes": [
        {
          "id": "301",
          "type": "FastNode",
          "position": { "x": 100, "y": 150 },
          "data": { 
            "title": "Plot Sine Wave", 
            "state": 0, 
            "code": "import numpy as np\nimport matplotlib.pyplot as plt\n\nx = np.linspace(0, 10, 100)\ny = np.sin(x)\n\nfig, ax = plt.subplots(figsize=(5, 3))\nax.plot(x, y, color='red')\nax.set_title('Sine Wave')\nax.grid(True)", 
            "inputs": [], 
            "outputs": [{ "id": "out-fig", "name": "fig" }] 
          }
        },
        {
          "id": "302",
          "type": "ObserverNode",
          "position": { "x": 450, "y": 150 },
          "data": { "title": "View Plot", "state": 0 }
        }
      ],
      "edges": [
        { "id": "e301-302", "source": "301", "sourceHandle": "out-fig", "target": "302", "targetHandle": null }
      ]
    },
    "Data Table (Pandas)": {
      "nodes": [
        {
          "id": "401",
          "type": "CustomNode",
          "position": { "x": 100, "y": 150 },
          "data": { 
            "title": "Create DataFrame", 
            "state": 0, 
            "code": "import pandas as pd\nimport numpy as np\n\ndf = pd.DataFrame({\n    'Name': ['Alice', 'Bob', 'Charlie', 'Diana'],\n    'Age': [24, 30, 22, 29],\n    'Score': np.random.randint(60, 100, 4)\n})", 
            "inputs": [], 
            "outputs": [{ "id": "out-df", "name": "df" }] 
          }
        },
        {
          "id": "402",
          "type": "ObserverNode",
          "position": { "x": 450, "y": 150 },
          "data": { "title": "View Table", "state": 0 }
        }
      ],
      "edges": [
        { "id": "e401-402", "source": "401", "sourceHandle": "out-df", "target": "402", "targetHandle": null }
      ]
    }
  };
