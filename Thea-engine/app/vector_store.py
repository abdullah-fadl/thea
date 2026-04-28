"""Vector store operations using ChromaDB"""
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
from pathlib import Path
import shutil
from app.config import settings


def get_chroma_client():
    """Get ChromaDB client (persistent mode)"""
    data_dir = Path(settings.data_dir)
    chroma_dir = data_dir / "chroma"
    chroma_dir.mkdir(parents=True, exist_ok=True)
    
    client = chromadb.PersistentClient(
        path=str(chroma_dir),
        settings=ChromaSettings(anonymized_telemetry=False)
    )
    
    return client


def get_collection(tenant_id: str):
    """Get or create collection for tenant"""
    client = get_chroma_client()
    collection_name = f"policies_{tenant_id}"
    
    try:
        collection = client.get_collection(collection_name)
    except Exception as exc:
        # Handle Chroma schema mismatch (e.g., sqlite column changes)
        if "collections.topic" in str(exc):
            print("[Chroma] Detected schema mismatch (collections.topic). Resetting Chroma store.")
            chroma_dir = Path(settings.data_dir) / "chroma"
            shutil.rmtree(chroma_dir, ignore_errors=True)
            chroma_dir.mkdir(parents=True, exist_ok=True)
            client = get_chroma_client()
        collection = client.create_collection(collection_name)
    
    return collection


def upsert_chunks(
    tenant_id: str,
    policy_id: str,
    chunks: List[Dict[str, Any]],
    batch_size: int = None
):
    """
    Upsert chunks into vector store
    
    Args:
        tenant_id: Tenant identifier
        policy_id: Policy identifier
        chunks: List of chunk dictionaries with keys:
            - chunk_id: str
            - text: str
            - embedding: List[float]
            - metadata: Dict with keys like filename, pageNumber, lineStart, lineEnd
        batch_size: Batch size for upserting (defaults to 200)
    """
    if batch_size is None:
        batch_size = 200
    
    collection = get_collection(tenant_id)
    
    # Process in batches
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        
        ids = [chunk["chunk_id"] for chunk in batch]
        embeddings = [chunk["embedding"] for chunk in batch]
        documents = [chunk["text"] for chunk in batch]
        metadatas = []
        
        for chunk in batch:
            metadata = chunk.get("metadata", {})
            # Ensure all metadata values are strings or numbers
            clean_metadata = {}
            for key, value in metadata.items():
                if isinstance(value, (str, int, float)):
                    clean_metadata[key] = value
                else:
                    clean_metadata[key] = str(value)
            clean_metadata["policyId"] = policy_id
            clean_metadata["tenantId"] = tenant_id
            metadatas.append(clean_metadata)
        
        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )


def delete_policy_chunks(tenant_id: str, policy_id: str):
    """
    Delete all chunks for a specific policy from vector store
    
    Args:
        tenant_id: Tenant identifier
        policy_id: Policy identifier
    """
    collection = get_collection(tenant_id)
    
    # Get all chunks for this policy, then delete by IDs
    try:
        results = collection.get(
            where={"policyId": policy_id}
        )
        
        if results["ids"] and len(results["ids"]) > 0:
            collection.delete(ids=results["ids"])
    except Exception as e:
        # If delete fails (e.g., no matching chunks), just log and continue
        print(f"Warning: Failed to delete chunks for policy {policy_id}: {e}")


def search(
    tenant_id: str,
    query: str,
    query_embedding: List[float],
    top_k: int = 10,
    policy_ids: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Search for similar chunks
    
    Args:
        tenant_id: Tenant identifier
        query: Original query text
        query_embedding: Query embedding vector
        top_k: Number of results to return
        policy_ids: Optional list of policy IDs to filter by
    
    Returns:
        List of result dictionaries with keys:
        - chunk_id: str
        - text: str
        - score: float
        - metadata: Dict
    """
    collection = get_collection(tenant_id)
    
    # Build where clause if policy_ids provided
    # ChromaDB where clause: use $in for list filtering
    query_kwargs = {
        "query_embeddings": [query_embedding],
        "n_results": top_k,
        "include": ["documents", "metadatas", "distances"]
    }
    
    if policy_ids and len(policy_ids) > 0:
        # Filter by policy IDs using ChromaDB where clause
        # ChromaDB supports $in operator: {"policyId": {"$in": ["id1", "id2"]}}
        query_kwargs["where"] = {"policyId": {"$in": policy_ids}}
    
    results = collection.query(**query_kwargs)
    
    # Format results
    formatted_results = []
    
    if results["ids"] and len(results["ids"][0]) > 0:
        for idx in range(len(results["ids"][0])):
            chunk_id = results["ids"][0][idx]
            document = results["documents"][0][idx]
            metadata = results["metadatas"][0][idx]
            distance = results["distances"][0][idx]
            
            # Convert distance to similarity score (lower distance = higher similarity)
            score = 1.0 - distance
            
            formatted_results.append({
                "chunk_id": chunk_id,
                "text": document,
                "score": score,
                "metadata": metadata
            })
    
    return formatted_results
