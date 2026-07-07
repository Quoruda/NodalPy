export const demos = {
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
