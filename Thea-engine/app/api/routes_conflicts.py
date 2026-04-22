"""Conflicts API routes - Phase 1: Rule-based detection (no OpenAI)"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from pathlib import Path
from app.config import settings
from app.manifest import load_manifest
from app.jobs import get_all_jobs
from app.vector_store import get_collection
from app.embeddings import generate_embeddings
import uuid
import re
import math


router = APIRouter()


class ConflictsRequest(BaseModel):
    tenantId: str
    mode: str  # "single" | "pair" | "global"
    policyIdA: Optional[str] = None
    policyIdB: Optional[str] = None
    strictness: str = "strict"  # "strict" | "balanced"
    category: Optional[str] = None
    limitPolicies: Optional[int] = 20


class IssueLocation(BaseModel):
    pageNumber: int
    lineStart: int
    lineEnd: int
    snippet: str


class PolicyRef(BaseModel):
    policyId: str
    filename: str


class Issue(BaseModel):
    issueId: str
    severity: str  # "HIGH" | "MED" | "LOW"
    type: str  # "CONFLICT" | "GAP" | "DUPLICATE" | "INCONSISTENCY"
    summary: str
    policyA: PolicyRef
    policyB: Optional[PolicyRef] = None
    locationA: IssueLocation
    locationB: Optional[IssueLocation] = None
    recommendation: str


class ConflictsResponse(BaseModel):
    tenantId: str
    mode: str
    issues: List[Issue]


def read_policy_text(tenant_id: str, policy_id: str) -> str:
    """Read policy text from storage"""
    try:
        data_dir = Path(settings.data_dir)
        # Try new path first: data/<tenantId>/<policyId>/text/
        text_dir = data_dir / tenant_id / policy_id / "text"
        if not text_dir.exists():
            # Fallback to old path: data/text/<tenantId>/<policyId>/
            text_dir = data_dir / "text" / tenant_id / policy_id
        
        if not text_dir.exists():
            return ""
        
        # Read all page text files
        text_parts = []
        page_files = sorted(text_dir.glob("page_*.txt"))
        
        for page_file in page_files:
            with open(page_file, "r", encoding="utf-8") as f:
                text_parts.append(f.read())
        
        return "\n\n".join(text_parts)
    except Exception as e:
        print(f"Error reading policy text for {policy_id}: {e}")
        return ""


def get_policy_chunks(tenant_id: str, policy_id: str) -> List[Dict[str, Any]]:
    """Get all chunks for a policy from vector store"""
    try:
        collection = get_collection(tenant_id)
        results = collection.get(
            where={"policyId": policy_id},
            include=["documents", "metadatas"]
        )
        
        chunks = []
        if results["ids"] and len(results["ids"]) > 0:
            for idx in range(len(results["ids"])):
                chunks.append({
                    "chunk_id": results["ids"][idx],
                    "text": results["documents"][idx],
                    "metadata": results["metadatas"][idx]
                })
        
        return chunks
    except Exception as e:
        print(f"Error getting chunks for policy {policy_id}: {e}")
        return []


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Calculate cosine similarity between two vectors"""
    if len(vec1) != len(vec2):
        return 0.0
    
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    magnitude1 = math.sqrt(sum(a * a for a in vec1))
    magnitude2 = math.sqrt(sum(a * a for a in vec2))
    
    if magnitude1 == 0 or magnitude2 == 0:
        return 0.0
    
    return dot_product / (magnitude1 * magnitude2)


def detect_gaps(policy_text: str, policy_id: str, filename: str) -> List[Issue]:
    """Detect missing core sections in a policy"""
    issues = []
    
    # Core section keywords
    core_sections = [
        "Purpose", "Scope", "Definitions", "Procedure", "Responsibilities",
        "Documentation", "References", "Approval", "Effective Date"
    ]
    
    text_lower = policy_text.lower()
    missing_sections = []
    
    for section in core_sections:
        # Check for section header patterns
        patterns = [
            rf"\b{section.lower()}\b",
            rf"{section.lower()}\s*:",
            rf"{section.lower()}\s*\n",
        ]
        
        found = any(re.search(pattern, text_lower, re.IGNORECASE) for pattern in patterns)
        if not found:
            missing_sections.append(section)
    
    if missing_sections:
        issue_id = str(uuid.uuid4())
        issues.append(Issue(
            issueId=issue_id,
            severity="MED",
            type="GAP",
            summary=f"Missing core sections: {', '.join(missing_sections)}",
            policyA=PolicyRef(policyId=policy_id, filename=filename),
            locationA=IssueLocation(
                pageNumber=1,
                lineStart=1,
                lineEnd=10,
                snippet="Policy structure analysis"
            ),
            recommendation=f"Consider adding the following sections: {', '.join(missing_sections)}"
        ))
    
    return issues


def detect_duplicates(tenant_id: str, policy_id: str, filename: str, strictness: str) -> List[Issue]:
    """Detect duplicate chunks within the same policy using embedding similarity"""
    issues = []
    
    chunks = get_policy_chunks(tenant_id, policy_id)
    if len(chunks) < 2:
        return issues
    
    # Generate embeddings for all chunks
    chunk_texts = [chunk["text"] for chunk in chunks]
    embeddings = generate_embeddings(chunk_texts)
    
    # Compare chunks pairwise
    threshold = 0.92  # High similarity threshold for duplicates
    
    for i in range(len(chunks)):
        for j in range(i + 1, len(chunks)):
            similarity = cosine_similarity(embeddings[i], embeddings[j])
            
            if similarity >= threshold:
                chunk_i = chunks[i]
                chunk_j = chunks[j]
                metadata_i = chunk_i.get("metadata", {})
                metadata_j = chunk_j.get("metadata", {})
                
                issue_id = str(uuid.uuid4())
                issues.append(Issue(
                    issueId=issue_id,
                    severity="LOW",
                    type="DUPLICATE",
                    summary=f"Duplicate content found: Similar chunks at different locations",
                    policyA=PolicyRef(policyId=policy_id, filename=filename),
                    locationA=IssueLocation(
                        pageNumber=metadata_i.get("pageNumber", 0),
                        lineStart=metadata_i.get("lineStart", 0),
                        lineEnd=metadata_i.get("lineEnd", 0),
                        snippet=chunk_i["text"][:200] + "..." if len(chunk_i["text"]) > 200 else chunk_i["text"]
                    ),
                    locationB=IssueLocation(
                        pageNumber=metadata_j.get("pageNumber", 0),
                        lineStart=metadata_j.get("lineStart", 0),
                        lineEnd=metadata_j.get("lineEnd", 0),
                        snippet=chunk_j["text"][:200] + "..." if len(chunk_j["text"]) > 200 else chunk_j["text"]
                    ),
                    recommendation="Consider consolidating duplicate content to avoid confusion"
                ))
    
    return issues


def detect_conflicts_pair(
    tenant_id: str,
    policy_id_a: str,
    policy_id_b: str,
    filename_a: str,
    filename_b: str,
    strictness: str
) -> List[Issue]:
    """Detect conflicts between two policies"""
    issues = []
    
    # Get chunks from both policies
    chunks_a = get_policy_chunks(tenant_id, policy_id_a)
    chunks_b = get_policy_chunks(tenant_id, policy_id_b)
    
    if not chunks_a or not chunks_b:
        print(f"Warning: No chunks found for policies. Policy A: {len(chunks_a) if chunks_a else 0} chunks, Policy B: {len(chunks_b) if chunks_b else 0} chunks")
        return issues
    
    print(f"Comparing {len(chunks_a)} chunks from policy A with {len(chunks_b)} chunks from policy B")
    
    # Generate embeddings for all chunks
    all_chunks = chunks_a + chunks_b
    all_texts = [chunk["text"] for chunk in all_chunks]
    all_embeddings = generate_embeddings(all_texts)
    
    # Find similar chunks between policies
    # Lower threshold to find more potential conflicts
    similarity_threshold = 0.60 if strictness == "balanced" else 0.68
    print(f"Using similarity threshold: {similarity_threshold} (strictness: {strictness})")
    
    similar_pairs = []
    max_similarity = 0.0
    for i, chunk_a in enumerate(chunks_a):
        embedding_a = all_embeddings[i]
        
        for j, chunk_b in enumerate(chunks_b):
            embedding_b = all_embeddings[len(chunks_a) + j]
            similarity = cosine_similarity(embedding_a, embedding_b)
            max_similarity = max(max_similarity, similarity)
            
            if similarity >= similarity_threshold:
                similar_pairs.append((i, j, similarity, chunk_a, chunk_b))
    
    print(f"Found {len(similar_pairs)} similar chunk pairs (similarity >= {similarity_threshold})")
    print(f"Max similarity found: {max_similarity:.4f}")
    
    # If no similar pairs found but max similarity is close to threshold, lower threshold slightly
    if len(similar_pairs) == 0 and max_similarity >= 0.55:
        print(f"Lowering threshold from {similarity_threshold} to {max_similarity - 0.02:.2f} to find potential issues")
        similarity_threshold = max(0.55, max_similarity - 0.02)
        similar_pairs = []
        for i, chunk_a in enumerate(chunks_a):
            embedding_a = all_embeddings[i]
            for j, chunk_b in enumerate(chunks_b):
                embedding_b = all_embeddings[len(chunks_a) + j]
                similarity = cosine_similarity(embedding_a, embedding_b)
                if similarity >= similarity_threshold:
                    similar_pairs.append((i, j, similarity, chunk_a, chunk_b))
        print(f"After lowering threshold: Found {len(similar_pairs)} similar chunk pairs")
    
    # Process similar pairs
    for i, j, similarity, chunk_a, chunk_b in similar_pairs:
        # Check for conflicting modality words
        text_a = chunk_a["text"].lower()
        text_b = chunk_b["text"].lower()
        
        # Conflicting modality patterns
        must_patterns = [
            (r"\bmust\b", r"\bmust\s+not\b"),
            (r"\bshall\b", r"\bshall\s+not\b"),
            (r"\brequired\b", r"\bprohibited\b"),
            (r"\brequired\b", r"\bnot\s+required\b"),
            (r"يجب\b", r"لا\s+يجوز\b"),
            (r"يجب\b", r"يمنع\b"),
            (r"يلزم\b", r"ممنوع\b"),
        ]
        
        has_conflict = False
        conflict_reason = ""
        for positive, negative in must_patterns:
            has_positive_a = bool(re.search(positive, text_a))
            has_negative_b = bool(re.search(negative, text_b))
            has_positive_b = bool(re.search(positive, text_b))
            has_negative_a = bool(re.search(negative, text_a))
            
            if (has_positive_a and has_negative_b) or (has_positive_b and has_negative_a):
                has_conflict = True
                conflict_reason = "conflicting modality words"
                break
        
        # Check for inconsistent numeric times/durations
        time_pattern = r"within\s+(\d+)\s+(hour|hours|day|days|minute|minutes)"
        times_a = re.findall(time_pattern, text_a, re.IGNORECASE)
        times_b = re.findall(time_pattern, text_b, re.IGNORECASE)
        
        if times_a and times_b:
            # Extract numeric values
            values_a = [int(t[0]) for t in times_a]
            values_b = [int(t[0]) for t in times_b]
            
            # Check if values differ significantly (e.g., 1 hour vs 24 hours)
            if values_a and values_b:
                min_a, max_a = min(values_a), max(values_a)
                min_b, max_b = min(values_b), max(values_b)
                
                # If ranges don't overlap or differ significantly
                if max(min_a, min_b) > min(max_a, max_b) or abs(min_a - min_b) > 12:
                    has_conflict = True
                    conflict_reason = "inconsistent numeric values"
        
        # Also check for general inconsistencies (different requirements on same topic)
        # If similarity is high but content differs significantly, it's an inconsistency
        if not has_conflict and similarity >= 0.70:
            # Check if chunks have different requirements or constraints
            # Simple heuristic: if both mention same keywords but have different structures
            key_words_a = set(re.findall(r'\b\w{4,}\b', text_a))
            key_words_b = set(re.findall(r'\b\w{4,}\b', text_b))
            common_words = key_words_a.intersection(key_words_b)
            
            # If they share significant keywords but have different lengths or structures
            if len(common_words) >= 3:
                len_diff = abs(len(text_a) - len(text_b))
                if len_diff > len(text_a) * 0.3:  # More than 30% length difference
                    has_conflict = True
                    conflict_reason = "inconsistent requirements on same topic"
        
        # If still no conflict but similarity is very high, report as potential inconsistency
        # Lower threshold to catch more cases
        if not has_conflict and similarity >= 0.70:
            has_conflict = True
            conflict_reason = "similar content with potential differences"
        
        if has_conflict:
            print(f"Conflict detected: {conflict_reason} (similarity: {similarity:.3f})")
            metadata_a = chunk_a.get("metadata", {})
            metadata_b = chunk_b.get("metadata", {})
            
            issue_id = str(uuid.uuid4())
            issues.append(Issue(
                issueId=issue_id,
                severity="HIGH",
                type="CONFLICT",
                summary=f"Conflicting requirements found between policies on similar topics ({conflict_reason})",
                policyA=PolicyRef(policyId=policy_id_a, filename=filename_a),
                policyB=PolicyRef(policyId=policy_id_b, filename=filename_b),
                locationA=IssueLocation(
                    pageNumber=metadata_a.get("pageNumber", 0),
                    lineStart=metadata_a.get("lineStart", 0),
                    lineEnd=metadata_a.get("lineEnd", 0),
                    snippet=chunk_a["text"][:300] + "..." if len(chunk_a["text"]) > 300 else chunk_a["text"]
                ),
                locationB=IssueLocation(
                    pageNumber=metadata_b.get("pageNumber", 0),
                    lineStart=metadata_b.get("lineStart", 0),
                    lineEnd=metadata_b.get("lineEnd", 0),
                    snippet=chunk_b["text"][:300] + "..." if len(chunk_b["text"]) > 300 else chunk_b["text"]
                ),
                recommendation="Review both policies and harmonize conflicting requirements. Consider updating one policy to match the other or creating a unified standard."
            ))
    
    return issues


def detect_inconsistencies(tenant_id: str, policy_id: str, filename: str) -> List[Issue]:
    """Detect inconsistencies within a single policy"""
    issues = []
    
    chunks = get_policy_chunks(tenant_id, policy_id)
    if len(chunks) < 2:
        return issues
    
    # Generate embeddings for all chunks
    chunk_texts = [chunk["text"] for chunk in chunks]
    embeddings = generate_embeddings(chunk_texts)
    
    # Find chunks about the same topic (high similarity)
    for i in range(len(chunks)):
        for j in range(i + 1, len(chunks)):
            similarity = cosine_similarity(embeddings[i], embeddings[j])
            
            if similarity >= 0.75:  # Same topic
                chunk_i = chunks[i]
                chunk_j = chunks[j]
                text_i = chunk_i["text"].lower()
                text_j = chunk_j["text"].lower()
                
                # Check for different numeric constraints
                numeric_pattern = r"(\d+)\s*(hour|hours|day|days|minute|minutes|patient|patients|time|times)"
                numbers_i = re.findall(numeric_pattern, text_i, re.IGNORECASE)
                numbers_j = re.findall(numeric_pattern, text_j, re.IGNORECASE)
                
                if numbers_i and numbers_j:
                    values_i = [int(n[0]) for n in numbers_i]
                    values_j = [int(n[0]) for n in numbers_j]
                    
                    # If values differ significantly
                    if values_i and values_j and abs(min(values_i) - min(values_j)) > 2:
                        metadata_i = chunk_i.get("metadata", {})
                        metadata_j = chunk_j.get("metadata", {})
                        
                        issue_id = str(uuid.uuid4())
                        issues.append(Issue(
                            issueId=issue_id,
                            severity="MED",
                            type="INCONSISTENCY",
                            summary=f"Inconsistent numeric constraints found for the same topic",
                            policyA=PolicyRef(policyId=policy_id, filename=filename),
                            locationA=IssueLocation(
                                pageNumber=metadata_i.get("pageNumber", 0),
                                lineStart=metadata_i.get("lineStart", 0),
                                lineEnd=metadata_i.get("lineEnd", 0),
                                snippet=chunk_i["text"][:200] + "..." if len(chunk_i["text"]) > 200 else chunk_i["text"]
                            ),
                            locationB=IssueLocation(
                                pageNumber=metadata_j.get("pageNumber", 0),
                                lineStart=metadata_j.get("lineStart", 0),
                                lineEnd=metadata_j.get("lineEnd", 0),
                                snippet=chunk_j["text"][:200] + "..." if len(chunk_j["text"]) > 200 else chunk_j["text"]
                            ),
                            recommendation="Standardize numeric constraints across the policy document"
                        ))
    
    return issues


@router.post("/v1/conflicts", response_model=ConflictsResponse)
async def detect_conflicts(request: ConflictsRequest):
    """
    Detect conflicts, gaps, duplicates, and inconsistencies in policies
    Phase 1: Rule-based detection (no OpenAI required)
    """
    # Validate request
    if request.mode not in ["single", "pair", "global"]:
        raise HTTPException(status_code=400, detail=f"Invalid mode: {request.mode}")
    
    if request.mode == "pair" and (not request.policyIdA or not request.policyIdB):
        raise HTTPException(status_code=400, detail="policyIdA and policyIdB required for pair mode")
    
    if request.mode == "single" and not request.policyIdA:
        raise HTTPException(status_code=400, detail="policyIdA required for single mode")
    
    issues: List[Issue] = []
    
    try:
        if request.mode == "single":
            # Single policy scan: GAP, DUPLICATE, INCONSISTENCY
            policy_id = request.policyIdA
            manifest = load_manifest(request.tenantId, policy_id)
            filename = manifest.get("filename", policy_id) if manifest else policy_id
            
            policy_text = read_policy_text(request.tenantId, policy_id)
            if not policy_text:
                raise HTTPException(status_code=404, detail=f"Policy {policy_id} not found or has no text")
            
            # Detect gaps
            issues.extend(detect_gaps(policy_text, policy_id, filename))
            
            # Detect duplicates
            issues.extend(detect_duplicates(request.tenantId, policy_id, filename, request.strictness))
            
            # Detect inconsistencies
            issues.extend(detect_inconsistencies(request.tenantId, policy_id, filename))
            
        elif request.mode == "pair":
            # Compare two policies: CONFLICT
            policy_id_a = request.policyIdA
            policy_id_b = request.policyIdB
            
            manifest_a = load_manifest(request.tenantId, policy_id_a)
            manifest_b = load_manifest(request.tenantId, policy_id_b)
            
            filename_a = manifest_a.get("filename", policy_id_a) if manifest_a else policy_id_a
            filename_b = manifest_b.get("filename", policy_id_b) if manifest_b else policy_id_b
            
            print(f"Pair mode: Comparing {filename_a} with {filename_b}")
            
            # Detect conflicts
            pair_issues = detect_conflicts_pair(
                request.tenantId,
                policy_id_a,
                policy_id_b,
                filename_a,
                filename_b,
                request.strictness
            )
            print(f"Pair mode: Found {len(pair_issues)} conflicts")
            issues.extend(pair_issues)
            
        elif request.mode == "global":
            # Global scan: compare top policies
            all_jobs = get_all_jobs(tenant_id=request.tenantId)
            policy_ids = list(set(job.get("policyId") for job in all_jobs if job.get("policyId")))
            
            # Filter by category if provided (simple filename match)
            if request.category:
                filtered_policy_ids = []
                for pid in policy_ids:
                    manifest = load_manifest(request.tenantId, pid)
                    if manifest:
                        filename = manifest.get("filename", "").lower()
                        if request.category.lower() in filename:
                            filtered_policy_ids.append(pid)
                policy_ids = filtered_policy_ids[:request.limitPolicies or 20]
            else:
                policy_ids = policy_ids[:request.limitPolicies or 20]
            
            # Compare pairs of policies
            for i in range(len(policy_ids)):
                for j in range(i + 1, len(policy_ids)):
                    policy_id_a = policy_ids[i]
                    policy_id_b = policy_ids[j]
                    
                    manifest_a = load_manifest(request.tenantId, policy_id_a)
                    manifest_b = load_manifest(request.tenantId, policy_id_b)
                    
                    filename_a = manifest_a.get("filename", policy_id_a) if manifest_a else policy_id_a
                    filename_b = manifest_b.get("filename", policy_id_b) if manifest_b else policy_id_b
                    
                    # Detect conflicts between this pair
                    pair_issues = detect_conflicts_pair(
                        request.tenantId,
                        policy_id_a,
                        policy_id_b,
                        filename_a,
                        filename_b,
                        request.strictness
                    )
                    issues.extend(pair_issues)
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to detect conflicts: {str(e)}"
        )
    
    return ConflictsResponse(
        tenantId=request.tenantId,
        mode=request.mode,
        issues=issues
    )
