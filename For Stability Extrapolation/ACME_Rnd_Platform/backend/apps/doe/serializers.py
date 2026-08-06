from rest_framework import serializers


class FactorSerializer(serializers.Serializer):
    name=serializers.CharField(max_length=120)
    low=serializers.FloatField()
    high=serializers.FloatField()
    def validate(self,data):
        if data["low"]>=data["high"]: raise serializers.ValidationError("High level must exceed low level.")
        return data
class GenerateSerializer(serializers.Serializer):
    factors=FactorSerializer(many=True,min_length=2,max_length=5)
class RankSerializer(serializers.Serializer):
    trials=serializers.ListField(child=serializers.DictField(),min_length=1,max_length=128)
    goals=serializers.ListField(child=serializers.DictField(),min_length=1,max_length=12)


class StabilityObservationSerializer(serializers.Serializer):
    month = serializers.FloatField(min_value=0)
    formulation = serializers.CharField(max_length=80)
    batch = serializers.CharField(max_length=120, required=False, allow_blank=True)
    response = serializers.FloatField()


class StabilityAnalysisSerializer(serializers.Serializer):
    observations = StabilityObservationSerializer(many=True, min_length=3, max_length=5000)
    response_name = serializers.CharField(max_length=120, default="Response")
    upper_limit = serializers.FloatField(required=False, allow_null=True)
    lower_limit = serializers.FloatField(required=False, allow_null=True)
    confidence_level = serializers.ChoiceField(choices=(0.90, 0.95, 0.99), default=0.95)
    pooling_alpha = serializers.FloatField(min_value=0.01, max_value=0.50, default=0.25)
    maximum_prediction_month = serializers.FloatField(min_value=1, max_value=600, default=60)
    prediction_month = serializers.FloatField(min_value=0, max_value=600, required=False)
    prediction_formulation = serializers.CharField(max_length=80, required=False, allow_blank=True)

    def validate(self, data):
        upper = data.get("upper_limit")
        lower = data.get("lower_limit")
        if upper is None and lower is None:
            raise serializers.ValidationError("Enter at least one specification limit.")
        if upper is not None and lower is not None and lower >= upper:
            raise serializers.ValidationError("The lower limit must be less than the upper limit.")
        if len({row["month"] for row in data["observations"]}) < 2:
            raise serializers.ValidationError("At least two different testing months are required.")
        if any(not row["formulation"].strip() for row in data["observations"]):
            raise serializers.ValidationError("Every observation requires a formulation type.")
        return data
