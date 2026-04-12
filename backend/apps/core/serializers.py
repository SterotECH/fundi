from rest_framework import serializers

from apps.core.models import AuditLog, Notification


class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "user",
            "user_email",
            "user_name",
            "organisation",
            "action",
            "action_display",
            "entity_type",
            "entity_id",
            "diff",
            "timestamp",
        ]
        read_only_fields = fields


class NotificationListSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source="get_type_display", read_only=True)

    class Meta:
        model = Notification
        fields = [
            "id",
            "type",
            "type_display",
            "message",
            "entity_type",
            "entity_id",
            "is_read",
            "created_at",
        ]
        read_only_fields = fields


class NotificationDetailSerializer(NotificationListSerializer):
    class Meta(NotificationListSerializer.Meta):
        fields = NotificationListSerializer.Meta.fields + [
            "user",
        ]
        read_only_fields = fields


class NotificationMarkReadSerializer(serializers.Serializer):
    pass
