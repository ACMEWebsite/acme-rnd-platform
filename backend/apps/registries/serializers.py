from rest_framework import serializers


class RegistryQuerySerializer(serializers.Serializer):
    query = serializers.CharField(max_length=500, trim_whitespace=True)

    def validate_query(self, value):
        if len(value) < 2:
            raise serializers.ValidationError("Enter at least two characters.")
        return value


class MhraQuerySerializer(RegistryQuerySerializer):
    document_types = serializers.ListField(child=serializers.ChoiceField(choices=["PAR", "SPC", "PIL"]), min_length=1, max_length=3)
