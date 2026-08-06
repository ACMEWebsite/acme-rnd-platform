from rest_framework import serializers


class PharmacokineticsPredictionSerializer(serializers.Serializer):
    compound_input = serializers.CharField(
        min_length=1,
        max_length=1000,
        trim_whitespace=True,
    )
    include_pubchem_enrichment = serializers.BooleanField(default=True)


class PsgSearchSerializer(serializers.Serializer):
    q = serializers.CharField(min_length=3, max_length=300, trim_whitespace=True)

