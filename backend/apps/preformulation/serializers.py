from rest_framework import serializers


class CompatibilitySerializer(serializers.Serializer):
    api_input = serializers.CharField(max_length=500, trim_whitespace=True)
    excipients = serializers.ListField(child=serializers.CharField(max_length=240), min_length=1, max_length=20)
    include_pubmed = serializers.BooleanField(default=True)

    def validate_api_input(self, value):
        if len(value) < 2:
            raise serializers.ValidationError("Enter an API name or a SMILES structure.")
        return value
