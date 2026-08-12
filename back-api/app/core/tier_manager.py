from typing import Dict, Any
from .config import core_config

def get_tier_config(user_tier: str) -> Dict[str, Any]:
    """
    Resolves the configuration limits for a given user tier.
    Uses the 'default' tier as a fallback for missing keys.
    """
    tiers = core_config.get("tiers") or {}
    
    # Always pull the default schema as the baseline
    default_schema = tiers.get("default", {})
    
    # If user's tier doesn't exist, we just return the default schema
    if user_tier not in tiers:
        return default_schema
        
    user_schema = tiers[user_tier]
    if user_schema is None:
        user_schema = {}
        
    # Merge default schema and user's tier schema
    # (user_schema values override default_schema, unless they are missing)
    resolved_config = {}
    for key in default_schema.keys():
        if key in user_schema:
            resolved_config[key] = user_schema[key]
        else:
            resolved_config[key] = default_schema[key]
            
    # For any extra keys in user_schema that aren't in default
    for key, value in user_schema.items():
        if key not in resolved_config:
            resolved_config[key] = value
            
    return resolved_config
