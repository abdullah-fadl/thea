"""OpenAI client helper for policy-engine"""
from typing import Optional
from openai import OpenAI
from app.config import settings


_openai_client: Optional[OpenAI] = None


def get_openai_client() -> Optional[OpenAI]:
    """
    Get OpenAI client singleton instance
    Returns None if OPENAI_API_KEY is not configured
    """
    global _openai_client
    
    if _openai_client is not None:
        return _openai_client
    
    if not settings.openai_api_key:
        return None
    
    try:
        _openai_client = OpenAI(api_key=settings.openai_api_key)
        return _openai_client
    except Exception as e:
        print(f"Failed to initialize OpenAI client: {e}")
        return None


def reset_openai_client():
    """Reset OpenAI client (useful for testing)"""
    global _openai_client
    _openai_client = None

