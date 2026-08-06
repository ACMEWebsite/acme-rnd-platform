from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import DoeRun
from .serializers import GenerateSerializer,RankSerializer,StabilityAnalysisSerializer
from .services import analyze_stability,generate_design,rank_trials


class StabilityAnalysisView(APIView):
 def post(self,request):
  serializer=StabilityAnalysisSerializer(data=request.data);serializer.is_valid(raise_exception=True)
  try:
   result=analyze_stability(**serializer.validated_data)
  except ValueError as exc:
   return Response({"detail":str(exc)},status=status.HTTP_400_BAD_REQUEST)
  return Response(result)


class GenerateDesignView(APIView):
 @transaction.atomic
 def post(self,request):
  serializer=GenerateSerializer(data=request.data);serializer.is_valid(raise_exception=True)
  design=generate_design(serializer.validated_data["factors"])
  run=DoeRun.objects.create(created_by=request.user,factors=serializer.validated_data["factors"],design=design)
  return Response({"run_id":run.pk,"design":design},status=status.HTTP_201_CREATED)
class RankTrialsView(APIView):
 def post(self,request):
  serializer=RankSerializer(data=request.data);serializer.is_valid(raise_exception=True)
  ranked=rank_trials(serializer.validated_data["trials"],serializer.validated_data["goals"])
  return Response({"ranked_trials":ranked,"best_trial":ranked[0] if ranked else None})
