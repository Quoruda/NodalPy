from typing import Any
from PIL import Image
import base64
import io
import json

def convert_value(value):
    try:
        # Handle PIL Images
        if hasattr(value, "save"):
            from PIL import Image
            if isinstance(value, Image.Image):
                buffered = io.BytesIO()
                value.save(buffered, format="PNG")
                img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
                return {"type": "image", "value": img_str}

        # Handle Matplotlib Figures
        if "matplotlib" in str(type(value)) and hasattr(value, "savefig"):
            buffered = io.BytesIO()
            value.savefig(buffered, format='png', bbox_inches='tight')
            buffered.seek(0)
            img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
            return {"type": "image", "value": img_str}
        
        # Handle Pandas DataFrames
        if "pandas.core.frame.DataFrame" in str(type(value)):
             return {"type": "table", "value": value.to_html(classes='table table-striped', index=False)}

        # Handle Numpy Arrays
        if "numpy.ndarray" in str(type(value)):
            return {"type": "list", "value": value.tolist()}

        if isinstance(value, (int, float, str, bool)):
            return {"type": type(value).__name__, "value": value}
        
        if isinstance(value, dict):
            # Try to serialize dict, if fails, str()
            try:
                json.dumps(value) # Check if serializable
                return {"type": "dict", "value": value}
            except:
                return {"type": "dict", "value": str(value)}

        if isinstance(value, list):
            return {"type": "list", "value": value}
        
        if isinstance(value, tuple):
            return {"type": "tuple", "value": list(value)}

        return {"type": type(value).__name__, "value": str(value)}

    except Exception as e:
        return {"type": "error", "value": str(e)}