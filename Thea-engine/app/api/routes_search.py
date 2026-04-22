"""Search API routes"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any
from app.embeddings import generate_embeddings
from app.vector_store import search
from app.config import settings
from pathlib import Path


router = APIRouter()


class SearchRequest(BaseModel):
    tenantId: str
    query: str
    topK: int = 10


class SearchResult(BaseModel):
    policyId: str
    filename: str
    score: float
    pageNumber: int
    lineStart: int
    lineEnd: int
    snippet: str
    reference: Dict[str, str]


class SearchResponse(BaseModel):
    tenantId: str
    query: str
    results: List[SearchResult]


@router.post("/v1/search", response_model=SearchResponse)
async def search_policies(request: SearchRequest):
    """
    Search policies
    
    Args:
        request: Search request with tenantId, query, and topK
    """
    # Generate query embedding
    query_embeddings = generate_embeddings([request.query])
    query_embedding = query_embeddings[0]
    
    # Search vector store
    search_results = search(
        request.tenantId,
        request.query,
        query_embedding,
        top_k=request.topK
    )
    
    # Format results
    formatted_results = []
    
    for result in search_results:
        metadata = result.get("metadata", {})
        policy_id = metadata.get("policyId", "")
        filename = metadata.get("filename", "unknown")
        page_number = metadata.get("pageNumber", 0)
        line_start = metadata.get("lineStart", 0)
        line_end = metadata.get("lineEnd", 0)
        
        # Get file path for reference
        data_dir = Path(settings.data_dir)
        policy_dir = data_dir / request.tenantId / policy_id
        file_path = policy_dir / filename
        
        formatted_results.append(SearchResult(
            policyId=policy_id,
            filename=filename,
            score=result.get("score", 0.0),
            pageNumber=page_number,
            lineStart=line_start,
            lineEnd=line_end,
            snippet=result.get("text", "")[:500],  # Limit snippet length
            reference={
                "source": "uploaded",
                "storedPath": str(file_path)
            }
        ))
    
    return SearchResponse(
        tenantId=request.tenantId,
        query=request.query,
        results=formatted_results
    )
