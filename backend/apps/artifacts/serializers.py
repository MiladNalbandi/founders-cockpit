from rest_framework import serializers

from .models import Artifact


class ArtifactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Artifact
        fields = (
            "id",
            "kind",
            "path",
            "size_bytes",
            "content_preview",
            "agent",
            "created_at",
            "updated_at",
        )
