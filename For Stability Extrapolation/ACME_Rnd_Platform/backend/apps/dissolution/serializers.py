from rest_framework import serializers


class DissolutionSimulationSerializer(serializers.Serializer):
    dose_mg = serializers.FloatField(min_value=0.000001, max_value=1_000_000)
    molecular_weight = serializers.FloatField(min_value=1, max_value=10_000)
    log_s = serializers.FloatField(min_value=-20, max_value=5)
    hia_percent = serializers.FloatField(min_value=0, max_value=100, required=False, allow_null=True)
    particle_diameter_um = serializers.FloatField(min_value=0.01, max_value=100_000, default=25.0)
    drug_density_g_cm3 = serializers.FloatField(min_value=0.01, max_value=30, default=1.2)
    medium_volume_ml = serializers.FloatField(min_value=1, max_value=100_000, default=900.0)
    boundary_layer_um = serializers.FloatField(min_value=0.01, max_value=100_000, default=30.0)
    duration_min = serializers.IntegerField(min_value=1, max_value=10_080, default=120)
    output_points = serializers.IntegerField(min_value=10, max_value=500, default=30)
