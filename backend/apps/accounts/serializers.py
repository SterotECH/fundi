from rest_framework import serializers

from apps.accounts.models import User


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class UserSerializer(serializers.ModelSerializer):
    organisation_name = serializers.CharField(
        source="organisation.name", read_only=True
    )

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "role",
            "created_at",
            "organisation_name",
        ]
        read_only_fields = ["id", "created_at"]


class UpdateMeSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = User
        fields = ["full_name", "password"]

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        instance = super().update(instance, validated_data)
        if password:
            instance.set_password(password)
            instance.save()
        return instance
