from rest_framework import serializers


class LiteratureChatSerializer(serializers.Serializer):
    workspace_id = serializers.IntegerField(min_value=1)
    question = serializers.CharField(max_length=2000, trim_whitespace=True)
    mode = serializers.ChoiceField(
        choices=["local", "gemini"],
        default="local",
    )
    allow_external_ai = serializers.BooleanField(default=False)

    def validate_question(self, value):
        if len(value.strip()) < 3:
            raise serializers.ValidationError("Enter a more specific question.")
        return value.strip()
