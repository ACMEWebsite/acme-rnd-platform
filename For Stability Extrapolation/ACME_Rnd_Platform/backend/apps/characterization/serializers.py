from rest_framework import serializers


class CharacterizationSearchSerializer(serializers.Serializer):
    query = serializers.CharField(max_length=500, trim_whitespace=True)

    def validate_query(self, value):
        if len(value) < 2:
            raise serializers.ValidationError("Enter at least two characters.")
        return value


class CharacterizationRunSerializer(serializers.Serializer):
    api_name = serializers.CharField(max_length=500, trim_whitespace=True)
    selected_properties = serializers.ListField(
        child=serializers.CharField(max_length=160), min_length=1, max_length=50
    )
    selected_records = serializers.ListField(
        child=serializers.DictField(), min_length=1, max_length=6
    )
