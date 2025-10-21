from typing import Any
from PIL import Image
import base64
import io

def convert_variable(variable: Any) -> Any:
    if isinstance(variable, str):
        return {"value": variable, "type": "string"}
    elif isinstance(variable, int):
        return {"value": variable, "type": "int"}
    elif isinstance(variable, float):
        return {"value": variable, "type": "float"}
    elif isinstance(variable, bool):
        return {"value": variable, "type": "bool"}
    elif isinstance(variable, dict):
        return {"value": str(variable), "type": "dict"}
    elif isinstance(variable, list):
        return {"value": str(variable), "type": "list"}
    elif isinstance(variable, tuple):
        return {"value": str(variable), "type": "tuple"}
    elif isinstance(variable, Image.Image):
        buffered = io.BytesIO()
        variable.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        return {"value": img_str, "type": "image/png"}
    else:
        return {"value": str(variable), "type": "unknown"}