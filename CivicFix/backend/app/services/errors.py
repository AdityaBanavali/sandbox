"""Shared exceptions for CivicFix AI services."""


class InvalidImageError(ValueError):
    """Raised when an image buffer is empty, corrupted, or unreadable."""
