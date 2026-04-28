"""Embedding generation with support for OpenAI and local providers"""
from typing import List
from app.config import settings
from app.openai_client import get_openai_client

# Global model (lazy initialized for local provider)
_embedding_model = None


def get_embedding_model():
    """Get or load local embedding model (SentenceTransformer)"""
    if settings.embeddings_provider != "local":
        return None
    
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        raise ImportError("sentence-transformers not installed. Install it or use EMBEDDINGS_PROVIDER=openai")
    
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = SentenceTransformer(settings.embedding_model)
    return _embedding_model


def generate_embeddings_openai(texts: List[str]) -> List[List[float]]:
    """
    Generate embeddings using OpenAI API
    
    Args:
        texts: List of text strings
    
    Returns:
        List of embedding vectors (each is a list of floats)
    """
    client = get_openai_client()
    if not client:
        raise ValueError("OpenAI client not available. Check OPENAI_API_KEY configuration.")
    
    # Use text-embedding-3-small model
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=texts
    )
    
    # Extract embeddings from response
    embeddings = [item.embedding for item in response.data]
    return embeddings


def generate_embeddings_local(texts: List[str]) -> List[List[float]]:
    """
    Generate embeddings using local SentenceTransformer model
    
    Args:
        texts: List of text strings
    
    Returns:
        List of embedding vectors (each is a list of floats)
    """
    model = get_embedding_model()
    if model is None:
        raise ValueError("Local embedding model not available")
    
    embeddings = model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
    
    # Convert numpy arrays to lists
    return embeddings.tolist()


def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Generate embeddings for a list of texts
    
    Uses OpenAI API if EMBEDDINGS_PROVIDER="openai", otherwise uses local SentenceTransformer.
    
    Args:
        texts: List of text strings
    
    Returns:
        List of embedding vectors (each is a list of floats)
    """
    if not texts:
        return []
    
    if settings.embeddings_provider == "openai":
        return generate_embeddings_openai(texts)
    elif settings.embeddings_provider == "local":
        return generate_embeddings_local(texts)
    else:
        raise ValueError(f"Invalid EMBEDDINGS_PROVIDER: {settings.embeddings_provider}. Must be 'openai' or 'local'.")
