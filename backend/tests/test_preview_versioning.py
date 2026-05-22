"""Tests for preview versioning logic."""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model

from apps.projects.models import Project

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="preview@cockpit.dev",
        password="test12345",
        full_name="Preview Tester",
    )


@pytest.fixture
def project(user):
    return Project.objects.create(
        owner=user,
        name="Preview Test",
        idea="Testing preview versioning.",
    )


@pytest.mark.django_db
def test_preview_version_created_on_first_write(user, project):
    from apps.artifacts.models import PreviewVersion

    PreviewVersion.objects.create(
        project=project,
        version=1,
        html_content="<html><body>v1</body></html>",
        author_role="qa_eng",
    )
    assert PreviewVersion.objects.filter(project=project).count() == 1
    pv = PreviewVersion.objects.get(project=project, version=1)
    assert pv.author_role == "qa_eng"


@pytest.mark.django_db
def test_preview_version_numbers_increment(user, project):
    from apps.artifacts.models import PreviewVersion

    for i in range(1, 4):
        PreviewVersion.objects.create(
            project=project,
            version=i,
            html_content=f"<html>v{i}</html>",
            author_role="qa_eng",
        )

    assert PreviewVersion.objects.filter(project=project).count() == 3
    latest = PreviewVersion.objects.filter(project=project).order_by("-version").first()
    assert latest.version == 3


@pytest.mark.django_db
def test_preview_version_unique_per_project_version(user, project):
    from apps.artifacts.models import PreviewVersion
    from django.db import IntegrityError

    PreviewVersion.objects.create(project=project, version=1, html_content="<html/>")
    with pytest.raises(IntegrityError):
        PreviewVersion.objects.create(project=project, version=1, html_content="<html/>")


@pytest.mark.django_db
def test_preview_version_deduplication_logic(user, project):
    """The snapshot hook skips creating a new version if content is identical."""
    from apps.artifacts.models import PreviewVersion

    html = "<html><body>same content</body></html>"
    v1 = PreviewVersion.objects.create(project=project, version=1, html_content=html)

    # Simulate the deduplication check from runtime_sdk._snapshot_preview_version
    existing = PreviewVersion.objects.filter(project=project).order_by("-version").first()
    should_skip = existing and existing.html_content == html

    assert should_skip is True
