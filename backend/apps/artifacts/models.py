from __future__ import annotations

from django.db import models
from django.utils import timezone


class ArtifactKind(models.TextChoices):
    SPEC = "spec", "Specification"
    DESIGN = "design", "Design"
    CODE = "code", "Code"
    DOC = "doc", "Document"
    OTHER = "other", "Other"

    @classmethod
    def guess_from_path(cls, path: str) -> str:
        p = path.lower()
        if p.endswith((".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".kt", ".swift")):
            return cls.CODE
        if "prd" in p or "spec" in p:
            return cls.SPEC
        if p.endswith((".html", ".css")) or "design" in p or "mockup" in p:
            return cls.DESIGN
        if p.endswith((".md", ".txt", ".rst")):
            return cls.DOC
        return cls.OTHER


class PreviewVersion(models.Model):
    """A snapshot of preview/index.html every time it gets rewritten.

    Lets the founder flip between versions, compare side-by-side, and see what
    changed at each iteration.
    """

    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="preview_versions",
    )
    version = models.IntegerField()  # 1, 2, 3, ... per project
    html_content = models.TextField()
    summary = models.CharField(
        max_length=400,
        blank=True,
        default="",
        help_text="Short plain-English description of what changed.",
    )
    author_role = models.CharField(max_length=32, blank=True, default="")
    pipeline_run = models.ForeignKey(
        "pipelines.PipelineRun",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="preview_versions",
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = (("project", "version"),)
        ordering = ("-version",)


class Artifact(models.Model):
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="artifacts"
    )
    agent = models.ForeignKey(
        "agents.Agent",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="artifacts",
    )
    kind = models.CharField(max_length=12, choices=ArtifactKind.choices, default=ArtifactKind.OTHER)
    path = models.CharField(max_length=500)  # workspace-relative
    abs_path = models.CharField(max_length=1000)
    content_preview = models.TextField(blank=True, default="")
    size_bytes = models.IntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = (("project", "path"),)
        ordering = ("-updated_at",)
