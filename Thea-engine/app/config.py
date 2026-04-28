"""Configuration for policy-engine service"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""
    
    # Data directory
    data_dir: str = os.getenv("POLICY_ENGINE_DATA_DIR", "./data")
    
    # Embedding provider: "openai" | "local" (default: "openai")
    embeddings_provider: str = os.getenv("EMBEDDINGS_PROVIDER", "openai")
    
    # Embedding model (for local provider)
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    
    # OpenAI API key (required when embeddings_provider="openai")
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY", None)
    
    # ChromaDB settings
    chroma_persist_directory: Path | None = None
    
    # Batch sizes
    vector_batch_size: int = 200
    chunk_size: int = 1000
    chunk_overlap: int = 150
    
    # OCR preset: "normal_ocr" | "table_ocr" (default: "normal_ocr")
    ocr_preset: str = os.getenv("OCR_PRESET", "normal_ocr")
    
    # OCR provider: "vision" | "tesseract" | "auto" (default: "auto")
    ocr_provider: str = os.getenv("OCR_PROVIDER", "auto")
    
    # Vision OCR settings
    vision_ocr_model: str = os.getenv("VISION_OCR_MODEL", "gpt-4o-mini")  # Note: gpt-4.1-mini doesn't exist, using gpt-4o-mini
    vision_ocr_detail: str = os.getenv("VISION_OCR_DETAIL", "high")  # "low" | "high" | "auto"
    vision_ocr_max_concurrency: int = int(os.getenv("VISION_OCR_MAX_CONCURRENCY", "2"))
    
    class Config:
        env_file = ".env"
        case_sensitive = False
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Validate embeddings provider (validation happens in main.py startup to allow graceful error handling)
        if self.embeddings_provider not in ["openai", "local"]:
            raise ValueError(f"EMBEDDINGS_PROVIDER must be 'openai' or 'local', got: {self.embeddings_provider}")
        
        # Validate OCR provider
        if self.ocr_provider not in ["vision", "tesseract", "auto"]:
            raise ValueError(f"OCR_PROVIDER must be 'vision', 'tesseract', or 'auto', got: {self.ocr_provider}")
        
        # Validate vision OCR detail
        if self.vision_ocr_detail not in ["low", "high", "auto"]:
            raise ValueError(f"VISION_OCR_DETAIL must be 'low', 'high', or 'auto', got: {self.vision_ocr_detail}")
        
        # Set ChromaDB persist directory
        data_path = Path(self.data_dir)
        self.chroma_persist_directory = data_path / "chroma"
        # Ensure directories exist
        self._ensure_directories()
    
    def _ensure_directories(self):
        """Ensure required directories exist"""
        data_path = Path(self.data_dir)
        dirs = [
            data_path / "files",
            data_path / "text",
            data_path / "manifests",
            data_path / "jobs",
            self.chroma_persist_directory,
        ]
        for dir_path in dirs:
            dir_path.mkdir(parents=True, exist_ok=True)


settings = Settings()
