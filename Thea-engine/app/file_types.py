from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple


ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/jpeg",
    "image/jpg",
    "image/png",
}

EXTENSION_TO_MIME = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain",
    "text": "text/plain",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
}

EXTENSION_TO_TYPE = {
    "pdf": "pdf",
    "docx": "docx",
    "txt": "txt",
    "text": "txt",
    "xls": "xls",
    "xlsx": "xlsx",
    "ppt": "ppt",
    "pptx": "pptx",
    "jpg": "jpg",
    "jpeg": "jpg",
    "png": "png",
}


@dataclass
class FileTypeInfo:
    file_type: str
    mime_type: str
    extension: str


def detect_file_type(filename: str, content_type: Optional[str]) -> FileTypeInfo:
    extension = (filename.split(".")[-1] if "." in filename else "").lower()
    inferred_mime = EXTENSION_TO_MIME.get(extension)
    normalized_mime = (content_type or "").lower()

    if not normalized_mime or normalized_mime not in ALLOWED_MIME_TYPES:
        raise ValueError(f"Unsupported content type: {content_type or 'unknown'}")

    if not inferred_mime or inferred_mime not in ALLOWED_MIME_TYPES:
        raise ValueError(f"Unsupported file extension: .{extension or 'unknown'}")

    if normalized_mime != inferred_mime:
        raise ValueError(
            f"Content type mismatch: got {normalized_mime} but extension suggests {inferred_mime}"
        )

    file_type = EXTENSION_TO_TYPE.get(extension)
    if not file_type:
        raise ValueError(f"Unsupported file extension: .{extension or 'unknown'}")

    return FileTypeInfo(file_type=file_type, mime_type=normalized_mime, extension=extension)
