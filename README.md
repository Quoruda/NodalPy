# NodalPy

![Licence MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Python](https://img.shields.io/badge/Python-3.x-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-20-brightgreen.svg)
![React](https://img.shields.io/badge/React-18-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.95-teal.svg)

**NodalPy** is a node-based visual development environment for real-time Python code execution in the browser. It combines the flexibility of Python scripting with an intuitive nodal interface for creating data processing workflows, algorithm prototypes, and visualizations.

## Key Features

*   **FastNodes**: Automatic and reactive execution. Updates to code or inputs trigger instant recalculation (debounced).
*   **Custom Nodes**: Designed for heavy tasks or precise control. Execution is triggered manually and is isolated from upstream parents.
*   **Value Nodes**: Ready-to-use typed inputs including Integer, Float, Boolean, String, and File (supports file uploads and relative paths).
*   **Observer Node**: Rich result visualization supporting Text, Numbers, Images (Matplotlib, PIL, base64), and interactive JSON formatting for Tables/Dictionaries.
*   **Project Persistence**:
    *   Native JSON Save/Load functionality.
    *   Automatic local backup via IndexedDB.
    *   Session-based file isolation.
*   **Security & Stability**:
    *   Infinite loop detection and prevention.
    *   Configurable execution timeouts.
    *   Robust WebSocket error handling.

---

## Installation and Build

### Prerequisites

*   **Python 3.8+** and `pip`
*   **Node.js 20+** and `npm`
*   Operating System: Linux, macOS, or Windows

### 1. Clone the Repository

```bash
git clone https://github.com/Quoruda/NodalPy.git
cd NodalPy
```

### 2. Build the Project

The `build.py` script automates frontend dependency installation, the React build process, and distribution folder preparation.

```bash
python3 build.py
```

### 3. Setup Python Environment

Using a virtual environment is recommended:

```bash
cd build/
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Run the Application

```bash
python3 main.py desktop
```

Available modes:
*   `desktop`: Launches the application in a native window (via PyWebView).
*   `local`: Starts the backend server only (accessible via `http://127.0.0.1:8000`).

---

## Project Structure

*   `back-api/`: FastAPI Backend. Manages Python code execution, WebSockets, and file system operations.
*   `front-editor/`: React Frontend. Node-based interface using ReactFlow, CodeMirror editor, and global state management.
*   `build/`: Automatically generated distribution folder containing the backend and compiled frontend.
*   `build.py`: Orchestration script for building and local deployment.

## Contribution

Contributions are welcome.
1.  Fork the project.
2.  Create a branch (`git checkout -b feature/my-feature`).
3.  Commit your changes.
4.  Push and create a Pull Request.

## License

Distributed under the **MIT** license. See the [LICENSE](LICENSE) file for more details.
